from django.shortcuts import render

from accounts.models import GamerProfile
from games.models import Game
from accounts.models import Post
from marketplace.models import Listing
from tournaments.models import Tournament
from teams.models import Team
from events.models import Event
from django.db.models import Q


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
    return render(request, "search.html", {
        "query": query,
        "gamers": GamerProfile.objects.filter(Q(gamer_tag__icontains=query) | Q(user__username__icontains=query))[:10] if query else [],
        "games": Game.objects.filter(name__icontains=query)[:10] if query else [],
        "posts": Post.objects.filter(body__icontains=query).select_related("author")[:10] if query else [],
        "listings": Listing.objects.filter(title__icontains=query).select_related("seller")[:10] if query else [],
        "tournaments": Tournament.objects.filter(name__icontains=query).select_related("game")[:10] if query else [],
        "teams": Team.objects.filter(name__icontains=query)[:10] if query else [],
        "events": Event.objects.filter(name__icontains=query)[:10] if query else [],
    })
