from datetime import timedelta

from django.conf import settings
from django.contrib.admin.views.decorators import staff_member_required
from django.http import FileResponse, JsonResponse
from django.shortcuts import render
from django.utils import timezone

from accounts.models import Block, GamerProfile, Message, Notification, Post, Report
from games.models import Game
from marketplace.models import Listing
from tournaments.models import Tournament
from teams.models import Team
from events.models import Event
from django.db.models import Q
from django.core.paginator import Paginator

from .companion import answer as companion_answer


def health_check(request):
    return JsonResponse({"status": "ok", "service": "GGz"})


def service_worker(request):
	return FileResponse((settings.BASE_DIR / "hello_world" / "static" / "ggz-service-worker.js").open("rb"), content_type="application/javascript")


def _companion_fallback_reply(message, user=None):
    normalized = (message or "").strip()
    lowered = normalized.lower()
    if not normalized:
        return "I’m ready to help you explore GGz. Ask me about games, players, tournaments, events, or community tips."
    if any(token in lowered for token in ("tournament", "event", "compete")):
        return "I can help you find active tournaments and local events, then guide you toward the best next move for your profile and schedule."
    if any(token in lowered for token in ("game", "discover", "recommend")):
        return "GGz is strongest when you connect your profile, favorite platforms, and local scene. I can suggest games and communities that fit your play style and location."
    if any(token in lowered for token in ("market", "listing", "buy", "sell")):
        return "Marketplace actions are best handled from the listing flow, and I can help you understand pricing, item quality, and safe meeting practices for local deals."
    if any(token in lowered for token in ("message", "profile", "follow", "community")):
        return "You can explore profiles, send message requests, follow players, and keep your GGz identity current from your dashboard and profile pages."
    if user and getattr(user, "gamer_profile", None):
        return f"{user.gamer_profile.gamer_tag}, I can help you move faster through GGz: discover players, browse tournaments, or sharpen your profile for the next session."
    return "I can help you navigate GGz, find games and players, and explain the platform in a way that fits your current goal."


def ai_companion(request):
    if request.method == "POST":
        request_times = [value for value in request.session.get("companion_request_times", []) if timezone.now().timestamp() - value < 60]
        if len(request_times) >= 20:
            return JsonResponse({"ok": False, "error": "GGz Companion is taking a short breather. Try again in a moment."}, status=429)
        request_times.append(timezone.now().timestamp())
        request.session["companion_request_times"] = request_times
        message = (request.POST.get("message") or "").strip()
        if not message:
            return JsonResponse({"ok": False, "error": "Please enter a message for GGz Companion."}, status=400)
        history = [
            entry for entry in request.session.get("companion_history", [])
            if entry.get("role") in {"user", "assistant"} and isinstance(entry.get("content"), str)
        ][-10:]
        companion = companion_answer(message, request.user, history=history)
        history.extend([
            {"role": "user", "content": message},
            {"role": "assistant", "content": companion["response"]},
        ])
        request.session["companion_history"] = history[-10:]
        request.session.modified = True
        return JsonResponse({
            "ok": True,
            **companion,
            "timestamp": timezone.now().isoformat(),
        })
    context = {
        "profile_count": GamerProfile.objects.count(),
        "game_count": Game.objects.count(),
        "user_profile": getattr(request.user, "gamer_profile", None) if request.user.is_authenticated else None,
        "upcoming_tournaments": Tournament.objects.select_related("game").filter(status__in=("Registration Open", "Live")).order_by("start_date")[:3],
    }
    return render(request, "hello_world/ai_companion.html", context)


@staff_member_required
def admin_dashboard(request):
    metrics = {
        "users": GamerProfile.objects.count(),
        "active_users": GamerProfile.objects.filter(presence__last_activity__gte=timezone.now() - timedelta(minutes=15)).count(),
        "posts": Post.objects.count(),
        "messages": Message.objects.count(),
        "games": Game.objects.count(),
        "active_events": Event.objects.filter(status__in=("Upcoming", "Live")).count(),
        "active_tournaments": Tournament.objects.filter(status__in=("Registration Open", "Live", "Registration Closed")).count(),
        "live_listings": Listing.objects.filter(status__in=("Available", "Reserved")).count(),
        "unread_notifications": Notification.objects.filter(is_read=False).count(),
        "pending_reports": Report.objects.count(),
        "recent_posts": Post.objects.select_related("author__user").order_by("-created_at")[:6],
        "recent_profiles": GamerProfile.objects.select_related("user").order_by("-created_at")[:6],
    }
    return render(request, "hello_world/admin_dashboard.html", metrics)


def index(request):
    context = {
        "profile_count": GamerProfile.objects.count(),
        "game_count": Game.objects.count(),
        "recent_posts": Post.objects.select_related("author__user", "game").prefetch_related("comments", "likes")[:3],
        "featured_games": Game.objects.order_by("-popularity", "name")[:4],
        "upcoming_tournaments": Tournament.objects.select_related("game", "organizer__user").filter(status__in=("Registration Open", "Live")).order_by("start_date")[:3],
        "upcoming_events": Event.objects.select_related("game", "organizer__user").filter(status__in=("Upcoming", "Live")).order_by("start_date")[:3],
    }

    if request.user.is_authenticated:
        context["user_profile"] = getattr(request.user, "gamer_profile", None)

    return render(request, "index.html", context)


def leaderboard(request):
    profiles = GamerProfile.objects.order_by("-respect_points", "gamer_tag")[:50]
    return render(request, "leaderboards.html", {"profiles": profiles})


def global_search(request):
    query = request.GET.get("q", "").strip()
    viewer = getattr(request.user, "gamer_profile", None)
    blocked_ids = Block.objects.filter(Q(blocker=viewer) | Q(blocked=viewer)).values_list("blocker_id", "blocked_id") if viewer else []
    blocked_profile_ids = {value for pair in blocked_ids for value in pair}
    def page(queryset, key):
        return Paginator(queryset.order_by("pk"), 10).get_page(request.GET.get(f"{key}_page"))
    def params_for(key):
        params = request.GET.copy()
        params.pop(f"{key}_page", None)
        return params.urlencode()
    return render(request, "search.html", {
        "query": query,
        "gamers": page(GamerProfile.objects.filter(Q(gamer_tag__icontains=query) | Q(user__username__icontains=query)).exclude(id__in=blocked_profile_ids), "gamers") if query else [],
        "games": page(Game.objects.filter(name__icontains=query), "games") if query else [],
        "posts": page(Post.objects.filter(body__icontains=query).exclude(author_id__in=blocked_profile_ids).select_related("author"), "posts") if query else [],
        "listings": page(Listing.objects.filter(title__icontains=query).select_related("seller"), "listings") if query else [],
        "tournaments": page(Tournament.objects.filter(name__icontains=query).select_related("game"), "tournaments") if query else [],
        "teams": page(Team.objects.filter(name__icontains=query), "teams") if query else [],
        "events": page(Event.objects.filter(name__icontains=query), "events") if query else [],
        "search_params": {key: params_for(key) for key in ("gamers", "games", "posts", "listings", "tournaments", "teams", "events")},
    })
