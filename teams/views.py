from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.utils.text import slugify

from accounts.models import GamerProfile, notify

from .models import Team, TeamInvitation, TeamMembership
from .forms import TeamForm


def _is_team_manager(profile, team):
    return bool(profile and (team.owner_id == profile.id or TeamMembership.objects.filter(team=team, player=profile, role="Captain").exists()))


def team_list(request):
    teams = Team.objects.filter(status="Active").select_related("game", "owner").prefetch_related("memberships").order_by("name")
    if request.GET.get("q"):
        teams = teams.filter(name__icontains=request.GET["q"])
    page = Paginator(teams.order_by("name"), 12).get_page(request.GET.get("page"))
    return render(request, "teams/team_list.html", {"page": page})


def team_detail(request, slug):
    team = get_object_or_404(Team.objects.select_related("owner", "game").prefetch_related("memberships__player__user"), slug=slug)
    tournaments = list(team.tournament_history)
    from tournaments.models import TournamentMatch

    memberships = team.memberships.select_related("player__user").order_by("role", "player__gamer_tag")
    captains = list(team.memberships.filter(role="Captain").select_related("player__user"))
    viewer = getattr(request.user, "gamer_profile", None)
    is_team_manager = _is_team_manager(viewer, team)
    member_ids = list(team.memberships.values_list("player_id", flat=True))
    invite_candidates = []
    if is_team_manager:
        invite_candidates = list(
            GamerProfile.objects.exclude(id__in=member_ids)
            .exclude(id=team.owner_id)
            .order_by("gamer_tag")
        )
    upcoming_matches = (
        TournamentMatch.objects.filter(status__in=("Scheduled", "Live"), tournament__registrations__player__team_memberships__team=team)
        .filter(Q(player_one__team_memberships__team=team) | Q(player_two__team_memberships__team=team))
        .distinct()
        .select_related("tournament", "game", "winner")[:5]
    )
    completed_matches = (
        TournamentMatch.objects.filter(status="Completed", tournament__registrations__player__team_memberships__team=team)
        .filter(Q(player_one__team_memberships__team=team) | Q(player_two__team_memberships__team=team))
        .distinct()
        .select_related("tournament", "game", "winner")[:5]
    )
    return render(
        request,
        "teams/team_detail.html",
        {
            "team": team,
            "memberships": memberships,
            "captains": captains,
            "tournaments": tournaments,
            "upcoming_matches": upcoming_matches,
            "completed_matches": completed_matches,
            "stats": {"wins": team.wins, "losses": team.losses, "matches_played": team.matches_played, "win_rate": team.win_rate},
            "viewer": viewer,
            "is_team_manager": is_team_manager,
            "invite_candidates": invite_candidates,
            "transfer_candidates": list(memberships.exclude(player=team.owner)),
        },
    )


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


@login_required
def team_invite(request, slug):
    if request.method != "POST":
        return HttpResponseForbidden("This action requires POST.")
    team = get_object_or_404(Team.objects.select_related("owner"), slug=slug)
    profile = get_object_or_404(GamerProfile, user=request.user)
    if not _is_team_manager(profile, team):
        return HttpResponseForbidden("You are not authorized to manage this team.")

    invitee_id = request.POST.get("invitee_id")
    if not invitee_id:
        messages.error(request, "Select a gamer to invite.")
        return render(request, "teams/team_detail.html", {"team": team})

    invitee = get_object_or_404(GamerProfile, id=invitee_id)
    if invitee == profile:
        messages.error(request, "You cannot invite yourself.")
        return render(request, "teams/team_detail.html", {"team": team})
    if TeamMembership.objects.filter(team=team, player=invitee).exists():
        messages.error(request, "This gamer is already on the team.")
        return render(request, "teams/team_detail.html", {"team": team})
    if TeamInvitation.objects.filter(team=team, invitee=invitee, status="Pending").exists():
        messages.error(request, "There is already a pending invitation for this gamer.")
        return render(request, "teams/team_detail.html", {"team": team})

    invitation = TeamInvitation.objects.create(team=team, inviter=profile, invitee=invitee, status="Pending")
    notify(invitee, profile, "team", f"{profile.gamer_tag} invited you to join {team.name}", f"/teams/{team.slug}/")
    messages.success(request, "Invitation sent.")
    return redirect("team_detail", slug=team.slug)


@login_required
def team_leave(request, slug):
    if request.method != "POST":
        return HttpResponseForbidden("This action requires POST.")
    team = get_object_or_404(Team, slug=slug)
    profile = get_object_or_404(GamerProfile, user=request.user)
    membership = get_object_or_404(TeamMembership, team=team, player=profile)
    if team.owner_id == profile.id:
        return HttpResponseForbidden("Transfer ownership before leaving the team.")
    membership.delete()
    messages.success(request, "You left the team.")
    return redirect("team_detail", slug=team.slug)


@login_required
def team_remove_member(request, slug, member_id):
    if request.method != "POST":
        return HttpResponseForbidden("This action requires POST.")
    team = get_object_or_404(Team, slug=slug)
    profile = get_object_or_404(GamerProfile, user=request.user)
    if not _is_team_manager(profile, team):
        return HttpResponseForbidden("You are not authorized to manage this team.")
    if team.owner_id == member_id:
        return HttpResponseForbidden("The owner cannot be removed through the member-removal action.")
    membership = get_object_or_404(TeamMembership, team=team, player_id=member_id)
    membership.delete()
    messages.success(request, "Member removed from the team.")
    return redirect("team_detail", slug=team.slug)


@login_required
def team_transfer_ownership(request, slug):
    if request.method != "POST":
        return HttpResponseForbidden("This action requires POST.")
    team = get_object_or_404(Team.objects.select_related("owner"), slug=slug)
    profile = get_object_or_404(GamerProfile, user=request.user)
    if team.owner_id != profile.id:
        return HttpResponseForbidden("Only the current owner can transfer ownership.")

    new_owner_id = request.POST.get("new_owner_id")
    if not new_owner_id:
        messages.error(request, "Choose a member to transfer ownership to.")
        return redirect("team_detail", slug=team.slug)

    new_owner = get_object_or_404(GamerProfile, id=new_owner_id)
    if not TeamMembership.objects.filter(team=team, player=new_owner).exists():
        messages.error(request, "Only current team members can become owner.")
        return redirect("team_detail", slug=team.slug)

    old_owner_membership = TeamMembership.objects.filter(team=team, player=team.owner).first()
    if old_owner_membership:
        old_owner_membership.role = "Member"
        old_owner_membership.save(update_fields=("role",))

    new_owner_membership = TeamMembership.objects.filter(team=team, player=new_owner).first()
    if new_owner_membership:
        new_owner_membership.role = "Captain"
        new_owner_membership.save(update_fields=("role",))

    team.owner = new_owner
    team.save(update_fields=("owner",))
    messages.success(request, "Ownership transferred.")
    return redirect("team_detail", slug=team.slug)
