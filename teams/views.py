from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.utils.text import slugify

from accounts.models import GamerProfile, notify

from .models import Team, TeamInvitation, TeamMembership
from .forms import TeamForm


def team_list(request):
    teams = Team.objects.filter(status="Active").select_related("game", "owner").prefetch_related("memberships").order_by("name")
    if request.GET.get("q"):
        teams = teams.filter(name__icontains=request.GET["q"])
    page = Paginator(teams.order_by("name"), 12).get_page(request.GET.get("page"))
    return render(request, "teams/team_list.html", {"page": page})


def team_detail(request, slug):
    team = get_object_or_404(Team.objects.select_related("owner", "game").prefetch_related("memberships__player"), slug=slug)
    return render(request, "teams/team_detail.html", {"team": team})


@login_required
def team_invitations(request):
    profile = get_object_or_404(GamerProfile, user=request.user)
    invitations = TeamInvitation.objects.filter(invitee=profile, status="Pending").select_related("team", "inviter")
    return render(request, "teams/invitations.html", {"invitations": invitations})


@login_required
def team_invitation_action(request, invitation_id, action):
    profile = get_object_or_404(GamerProfile, user=request.user)
    invitation = get_object_or_404(TeamInvitation.objects.select_related("team"), id=invitation_id, invitee=profile, status="Pending")
    if request.method != "POST" or action not in ("accept", "decline"):
        return HttpResponseForbidden("Invalid invitation action.")
    if action == "accept":
        _, created = TeamMembership.objects.get_or_create(team=invitation.team, player=profile, defaults={"role": "Member"})
        messages.success(request, "You joined the team." if created else "You are already a team member.")
        invitation.status = "Accepted"
        notify(invitation.inviter, profile, "team", f"{profile.gamer_tag} joined {invitation.team.name}", f"/teams/{invitation.team.slug}/")
    else:
        invitation.status = "Declined"
        messages.success(request, "Team invitation declined.")
    invitation.save(update_fields=("status",))
    return redirect("team_invitations")


@login_required
def team_create(request):
    form = TeamForm(request.POST or None)
    if form.is_valid():
        team = form.save(commit=False)
        team.owner = get_object_or_404(GamerProfile, user=request.user)
        team.slug = slugify(team.name)
        team.save()
        TeamMembership.objects.create(team=team, player=team.owner, role="Captain")
        messages.success(request, "Your team was created.")
        return redirect("team_detail", slug=team.slug)
    return render(request, "teams/team_form.html", {"form": form})
