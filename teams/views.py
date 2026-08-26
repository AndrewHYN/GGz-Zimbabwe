from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.shortcuts import get_object_or_404, redirect, render

from accounts.models import GamerProfile

from .models import Team, TeamInvitation, TeamMembership


def team_list(request):
    teams = Team.objects.filter(status="Active").select_related("game", "owner").prefetch_related("memberships")
    if request.GET.get("q"):
        teams = teams.filter(name__icontains=request.GET["q"])
    page = Paginator(teams, 12).get_page(request.GET.get("page"))
    return render(request, "teams/team_list.html", {"page": page})


def team_detail(request, slug):
    team = get_object_or_404(Team.objects.select_related("owner", "game").prefetch_related("memberships__player"), slug=slug)
    return render(request, "teams/team_detail.html", {"team": team})


@login_required
def team_create(request):
    if request.method == "POST":
        profile = get_object_or_404(GamerProfile, user=request.user)
        name = request.POST.get("name", "").strip()
        if name:
            team = Team.objects.create(owner=profile, name=name, tag=request.POST.get("tag", "GGZ"), slug=name.lower().replace(" ", "-"), description=request.POST.get("description", ""))
            TeamMembership.objects.create(team=team, player=profile, role="Captain")
            return redirect("team_detail", slug=team.slug)
    return render(request, "teams/team_form.html")
