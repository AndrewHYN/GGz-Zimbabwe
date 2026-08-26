from django.shortcuts import render

from accounts.models import GamerProfile
from games.models import Game
from accounts.models import Post
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
    }

    if request.user.is_authenticated:
        context["user_profile"] = getattr(request.user, "gamer_profile", None)

    return render(request, "index.html", context)


def leaderboard(request):
    profiles = GamerProfile.objects.order_by("-respect_points", "gamer_tag")[:50]
    return render(request, "leaderboards.html", {"profiles": profiles})


def global_search(request):
    query = request.GET.get("q", "").strip()
    def page(queryset, key):
        return Paginator(queryset, 10).get_page(request.GET.get(f"{key}_page"))
    return render(request, "search.html", {
        "query": query,
        "gamers": page(GamerProfile.objects.filter(Q(gamer_tag__icontains=query) | Q(user__username__icontains=query)), "gamers") if query else [],
        "games": page(Game.objects.filter(name__icontains=query), "games") if query else [],
        "posts": page(Post.objects.filter(body__icontains=query).select_related("author"), "posts") if query else [],
        "listings": page(Listing.objects.filter(title__icontains=query).select_related("seller"), "listings") if query else [],
        "tournaments": page(Tournament.objects.filter(name__icontains=query).select_related("game"), "tournaments") if query else [],
        "teams": page(Team.objects.filter(name__icontains=query), "teams") if query else [],
        "events": page(Event.objects.filter(name__icontains=query), "events") if query else [],
    })
