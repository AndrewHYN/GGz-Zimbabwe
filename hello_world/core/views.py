from django.shortcuts import render

from accounts.models import Block, GamerProfile, Post
from games.models import Game
from marketplace.models import Listing
from tournaments.models import Tournament
from teams.models import Team
from events.models import Event
from django.db.models import Q
from django.core.paginator import Paginator


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
