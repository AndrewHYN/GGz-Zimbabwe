from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Case, F, IntegerField, Q, Value, When
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.utils.text import slugify

from accounts.models import Block, Follow, GamerProfile, Notification, Friendship, notify

from .forms import ChallengeForm, MatchCreateForm, MatchResultForm, MatchScheduleForm, TournamentForm
from .models import Challenge, Tournament, TournamentInvitation, TournamentMatch, TournamentRegistration
from teams.models import Team, TeamMembership


def tournament_list(request):
	tournaments = Tournament.objects.select_related("game", "organizer").prefetch_related("registrations")
	query = request.GET.get("q", "").strip()
	if query:
		tournaments = tournaments.filter(Q(name__icontains=query) | Q(description__icontains=query) | Q(game__name__icontains=query) | Q(location__icontains=query))
	for field in ("status", "format", "mode"):
		if request.GET.get(field):
			tournaments = tournaments.filter(**{field: request.GET[field]})
	if request.GET.get("game"):
		tournaments = tournaments.filter(game_id=request.GET["game"])
	if request.GET.get("location"):
		tournaments = tournaments.filter(location__icontains=request.GET["location"])
	page = Paginator(tournaments, 12).get_page(request.GET.get("page"))
	from games.models import Game
	return render(request, "tournaments/tournament_list.html", {"page": page, "game_choices": Game.objects.order_by("name"), "status_choices": Tournament.STATUS_CHOICES, "format_choices": Tournament.FORMAT_CHOICES})


def tournament_detail(request, slug):
	tournament = get_object_or_404(Tournament.objects.select_related("game", "organizer__user").prefetch_related("registrations__player", "invitations", "matches__player_one", "matches__player_two"), slug=slug)
	player = getattr(request.user, "gamer_profile", None)
	registration = TournamentRegistration.objects.filter(tournament=tournament, player=player).first() if player else None
	invitation = TournamentInvitation.objects.filter(tournament=tournament, player=player).first() if player else None
	pending_challenges = []
	incoming_challenges = []
	outgoing_challenges = []
	if player:
		pending_challenges = list(tournament.challenges.select_related("challenger__user", "opponent__user", "game").order_by("-created_at"))
		incoming_challenges = list(tournament.challenges.filter(opponent=player, status="Pending").select_related("challenger__user", "game").order_by("-created_at"))
		outgoing_challenges = list(tournament.challenges.filter(challenger=player, status="Pending").select_related("opponent__user", "game").order_by("-created_at"))
	return render(request, "tournaments/tournament_detail.html", {"tournament": tournament, "registration": registration, "invitation": invitation, "challenge_form": ChallengeForm(initial={"tournament": tournament.id, "game": tournament.game_id}), "pending_challenges": pending_challenges, "incoming_challenges": incoming_challenges, "outgoing_challenges": outgoing_challenges, "player": player})


@login_required
def tournament_my(request):
	profile = get_object_or_404(GamerProfile, user=request.user)
	tournaments = Tournament.objects.filter(organizer=profile).select_related("game").prefetch_related("registrations", "matches")
	return render(request, "tournaments/tournament_my.html", {"tournaments": tournaments})


@login_required
def tournament_manage(request, slug):
	tournament = get_object_or_404(Tournament.objects.prefetch_related("registrations__player", "invitations__player", "matches__player_one", "matches__player_two"), slug=slug, organizer__user=request.user)
	return render(request, "tournaments/tournament_manage.html", {"tournament": tournament, "invite_candidates": _invite_candidates(tournament, tournament.organizer), "pending_invitations": tournament.invitations.filter(status="Pending"), "accepted_invitations": tournament.invitations.filter(status="Accepted"), "declined_invitations": tournament.invitations.filter(status="Declined")})


def _invite_candidates(tournament, organizer):
	blocked_ids = Block.objects.filter(Q(blocker=organizer) | Q(blocked=organizer)).values_list("blocker_id", "blocked_id")
	blocked_profile_ids = {value for pair in blocked_ids for value in pair}
	registered_ids = TournamentRegistration.objects.filter(tournament=tournament, status__in=("Registered", "Waitlisted")).values_list("player_id", flat=True)
	pending_ids = TournamentInvitation.objects.filter(tournament=tournament, status="Pending").values_list("player_id", flat=True)
	friend_ids = Friendship.objects.filter(Q(profile_one=organizer) | Q(profile_two=organizer)).values_list("profile_one_id", "profile_two_id")
	friend_profile_ids = {value for pair in friend_ids for value in pair} - {organizer.id}
	following_ids = Follow.objects.filter(follower=organizer).values_list("following_id", flat=True)
	return GamerProfile.objects.select_related("user").prefetch_related("games").filter(games=tournament.game).exclude(id=organizer.id).exclude(id__in=blocked_profile_ids).exclude(id__in=registered_ids).exclude(id__in=pending_ids).annotate(
		social_priority=Case(
			When(id__in=friend_profile_ids, then=Value(3)),
			When(id__in=following_ids, then=Value(2)),
			default=Value(0),
			output_field=IntegerField(),
		)
	).order_by("-social_priority", "-respect_points", "gamer_tag")


@login_required
def tournament_invite(request, slug):
	tournament = get_object_or_404(Tournament, slug=slug, organizer__user=request.user)
	organizer = tournament.organizer
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	if tournament.status != "Registration Open" or timezone.now() > tournament.registration_deadline:
		return HttpResponseForbidden("Invitations are closed.")
	if tournament.participant_count >= tournament.max_participants:
		return HttpResponseForbidden("This tournament is full.")
	selected_ids = {int(value) for value in request.POST.getlist("player_ids") if value.isdigit()}
	eligible_ids = set(_invite_candidates(tournament, organizer).filter(id__in=selected_ids).values_list("id", flat=True))
	created = 0
	for player_id in eligible_ids:
		invitation, was_created = TournamentInvitation.objects.get_or_create(tournament=tournament, player_id=player_id, defaults={"status": "Pending"})
		if not was_created and invitation.status == "Declined":
			invitation.status = "Pending"
			invitation.responded_at = None
			invitation.save(update_fields=("status", "responded_at"))
		if was_created or invitation.status == "Pending":
			created += 1
			player = GamerProfile.objects.get(id=player_id)
			notify(player, organizer, "tournament_invitation", f"{organizer.gamer_tag} invited you to {tournament.name}", f"/tournaments/{tournament.slug}/")
	messages.success(request, f"Sent {created} tournament invitation{'s' if created != 1 else ''}.")
	return redirect("tournament_manage", slug=tournament.slug)


@login_required
def tournament_invitation_action(request, invitation_id, action):
	if request.method != "POST" or action not in ("accept", "decline"):
		return HttpResponseForbidden("Invalid invitation action.")
	player = get_object_or_404(GamerProfile, user=request.user)
	invitation = get_object_or_404(TournamentInvitation.objects.select_related("tournament", "tournament__organizer"), id=invitation_id, player=player, status="Pending")
	tournament = invitation.tournament
	if action == "decline":
		invitation.status = "Declined"
		invitation.responded_at = timezone.now()
		invitation.save(update_fields=("status", "responded_at"))
		messages.success(request, f"You declined the invitation to {tournament.name}.")
		return redirect("tournament_detail", slug=tournament.slug)
	if tournament.status != "Registration Open" or timezone.now() > tournament.registration_deadline:
		return HttpResponseForbidden("This invitation is no longer valid.")
	if not player.games.filter(id=tournament.game_id).exists():
		return HttpResponseForbidden("You are not eligible for this tournament's game.")
	if tournament.participant_count >= tournament.max_participants:
		return HttpResponseForbidden("This tournament is full.")
	registration, created = TournamentRegistration.objects.get_or_create(tournament=tournament, player=player, defaults={"status": "Registered"})
	if not created and registration.status not in ("Withdrawn", "Waitlisted"):
		return HttpResponseForbidden("You are already participating in this tournament.")
	if not created:
		registration.status = "Registered"
		registration.save(update_fields=("status",))
	invitation.status = "Accepted"
	invitation.responded_at = timezone.now()
	invitation.save(update_fields=("status", "responded_at"))
	notify(tournament.organizer, player, "tournament_invitation", f"{player.gamer_tag} accepted the invitation to {tournament.name}", f"/tournaments/{tournament.slug}/manage/")
	messages.success(request, f"You joined {tournament.name}.")
	return redirect("tournament_detail", slug=tournament.slug)


@login_required
def match_schedule(request, match_id):
	match = get_object_or_404(TournamentMatch, id=match_id, tournament__organizer__user=request.user)
	form = MatchScheduleForm(request.POST or None, instance=match)
	if form.is_valid():
		form.save()
		messages.success(request, "Match schedule updated.")
		return redirect("tournament_manage", slug=match.tournament.slug)
	return render(request, "tournaments/match_form.html", {"form": form, "match": match, "tournament": match.tournament, "schedule_only": True})


@login_required
def tournament_edit(request, slug):
	tournament = get_object_or_404(Tournament, slug=slug, organizer__user=request.user)
	form = TournamentForm(request.POST or None, request.FILES or None, instance=tournament)
	if form.is_valid():
		form.save()
		messages.success(request, "Your tournament was updated.")
		return redirect("tournament_manage", slug=tournament.slug)
	return render(request, "tournaments/tournament_form.html", {"form": form, "title": "Edit tournament", "tournament": tournament})


@login_required
def tournament_delete(request, slug):
	tournament = get_object_or_404(Tournament, slug=slug, organizer__user=request.user)
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	tournament.delete()
	messages.success(request, "Your tournament was deleted.")
	return redirect("tournament_my")


@login_required
def tournament_toggle_registration(request, slug):
	tournament = get_object_or_404(Tournament, slug=slug, organizer__user=request.user)
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	if tournament.status == "Registration Open":
		tournament.status = "Registration Closed"
		message = "Registration closed."
	else:
		tournament.status = "Registration Open"
		message = "Registration opened."
	tournament.save(update_fields=("status",))
	messages.success(request, message)
	return redirect("tournament_manage", slug=tournament.slug)


@login_required
def tournament_cancel(request, slug):
	tournament = get_object_or_404(Tournament, slug=slug, organizer__user=request.user)
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	tournament.status = "Cancelled"
	tournament.save(update_fields=("status",))
	messages.success(request, "The tournament was cancelled.")
	return redirect("tournament_manage", slug=tournament.slug)


def _advance_winner(match):
	if match.status != "Completed" or not match.winner or not match.next_match:
		return
	next_match = match.next_match
	sources = list(TournamentMatch.objects.filter(next_match=next_match).order_by("id"))
	if sources and sources[0].id == match.id:
		next_match.player_one = match.winner
	else:
		next_match.player_two = match.winner
	next_match.save(update_fields=("player_one", "player_two"))
	if next_match.player_one and next_match.player_two:
		return
	if next_match.player_one or next_match.player_two:
		next_match.winner = next_match.player_one or next_match.player_two
		next_match.status = "Completed"
		next_match.score = "Bye"
		next_match.save(update_fields=("winner", "status", "score"))
		if not next_match.next_match_id:
			GamerProfile.objects.filter(id=next_match.winner_id).update(tournament_wins=F("tournament_wins") + 1)
			next_match.tournament.status = "Completed"
			next_match.tournament.save(update_fields=("status",))
		_advance_winner(next_match)


@login_required
def generate_bracket(request, slug):
	tournament = get_object_or_404(Tournament, slug=slug, organizer__user=request.user)
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	if tournament.format != "1v1" or tournament.matches.exists():
		messages.error(request, "This tournament cannot generate a new bracket.")
		return redirect("tournament_manage", slug=slug)
	players = list(TournamentRegistration.objects.filter(tournament=tournament, status="Registered").order_by("joined_at").values_list("player", flat=True))
	if len(players) < 2:
		messages.error(request, "At least two registered players are required.")
		return redirect("tournament_manage", slug=slug)
	size = 1
	while size < len(players):
		size *= 2
	players += [None] * (size - len(players))
	with transaction.atomic():
		rounds = {1: []}
		for index in range(0, size, 2):
			rounds[1].append(TournamentMatch.objects.create(tournament=tournament, game=tournament.game, player_one_id=players[index], player_two_id=players[index + 1]))
		round_count = size.bit_length() - 1
		for round_number in range(2, round_count + 1):
			rounds[round_number] = [TournamentMatch.objects.create(tournament=tournament, game=tournament.game, round=round_number) for _ in range(len(rounds[round_number - 1]) // 2)]
		for round_number in range(1, round_count):
			for index, match in enumerate(rounds[round_number]):
				match.next_match = rounds[round_number + 1][index // 2]
				match.save(update_fields=("next_match",))
		for match in rounds[1]:
			if bool(match.player_one) != bool(match.player_two):
				match.winner = match.player_one or match.player_two
				match.status = "Completed"
				match.score = "Bye"
				match.save(update_fields=("winner", "status", "score"))
				_advance_winner(match)
	messages.success(request, "The tournament bracket was generated.")
	return redirect("tournament_manage", slug=slug)


@login_required
def registration_action(request, registration_id, action):
	registration = get_object_or_404(TournamentRegistration.objects.select_related("tournament"), id=registration_id, tournament__organizer__user=request.user)
	if request.method != "POST" or action not in ("approve", "reject", "remove"):
		return HttpResponseForbidden("Invalid registration action.")
	if action == "remove":
		registration.delete()
	else:
		registration.status = "Registered" if action == "approve" else "Disqualified"
		registration.save(update_fields=("status",))
		notify(registration.player, request.user.gamer_profile, "tournament", f"Your registration for {registration.tournament.name} was updated", f"/tournaments/{registration.tournament.slug}/")
	return redirect("tournament_manage", slug=registration.tournament.slug)


@login_required
def tournament_create(request):
	form = TournamentForm(request.POST or None, request.FILES or None)
	if form.is_valid():
		tournament = form.save(commit=False)
		tournament.organizer = get_object_or_404(GamerProfile, user=request.user)
		tournament.slug = slugify(tournament.name)
		if Tournament.objects.filter(slug=tournament.slug).exists():
			form.add_error("name", "A tournament with this name already exists.")
		else:
			tournament.save()
			messages.success(request, "Your tournament was created.")
			return redirect("tournament_detail", slug=tournament.slug)
	return render(request, "tournaments/tournament_form.html", {"form": form, "title": "Create tournament"})


@login_required
def tournament_register(request, slug):
	tournament = get_object_or_404(Tournament, slug=slug)
	player = get_object_or_404(GamerProfile, user=request.user)
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	if tournament.status != "Registration Open" or timezone.now() > tournament.registration_deadline:
		return HttpResponseForbidden("Registration is closed.")

	team_id = request.POST.get("team_id")
	if team_id:
		team = get_object_or_404(Team, id=team_id)
		if team.game_id != tournament.game_id:
			return HttpResponseForbidden("This team is not compatible with this tournament's game.")
		if team.owner_id != player.id and not TeamMembership.objects.filter(team=team, player=player, role="Captain").exists():
			return HttpResponseForbidden("Only the team owner or captain can register the team.")
		members = list(TeamMembership.objects.filter(team=team).select_related("player"))
		if not members:
			return HttpResponseForbidden("This team has no members to register.")
		new_count = TournamentRegistration.objects.filter(tournament=tournament, status="Registered").count() + len(members)
		if new_count > tournament.max_participants:
			return HttpResponseForbidden("This team would exceed the tournament participant limit.")
		for membership in members:
			registration, _ = TournamentRegistration.objects.get_or_create(tournament=tournament, player=membership.player, defaults={"status": "Registered"})
			if registration.status in ("Withdrawn", "Waitlisted"):
				registration.status = "Registered"
				registration.save(update_fields=("status",))
		notify(tournament.organizer, player, "tournament", f"{team.name} registered for {tournament.name}", f"/tournaments/{tournament.slug}/manage/")
		messages.success(request, "Your team joined the tournament.")
		return redirect("tournament_detail", slug=slug)

	if tournament.participant_count >= tournament.max_participants:
		return HttpResponseForbidden("This tournament is full.")
	registration, _ = TournamentRegistration.objects.get_or_create(tournament=tournament, player=player, defaults={"status": "Registered"})
	if registration.status in ("Withdrawn", "Waitlisted"):
		registration.status = "Registered"
		registration.save(update_fields=("status",))
	notify(tournament.organizer, player, "tournament", f"{player.gamer_tag} registered for {tournament.name}", f"/tournaments/{tournament.slug}/manage/")
	messages.success(request, "You joined the tournament.")
	return redirect("tournament_detail", slug=slug)


@login_required
def tournament_leave(request, slug):
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	tournament = get_object_or_404(Tournament, slug=slug)
	TournamentRegistration.objects.filter(tournament=tournament, player__user=request.user, status__in=("Registered", "Waitlisted")).update(status="Withdrawn")
	messages.success(request, "You left the tournament.")
	return redirect("tournament_detail", slug=slug)


@login_required
def challenge_create(request, slug):
	tournament = get_object_or_404(Tournament, slug=slug)
	form = ChallengeForm(request.POST or None)
	if form.is_valid():
		challenge = form.save(commit=False)
		challenge.challenger = get_object_or_404(GamerProfile, user=request.user)
		challenge.tournament = tournament
		if challenge.game_id != tournament.game_id:
			form.add_error("game", "Challenges must use this tournament's game.")
		if challenge.opponent == challenge.challenger:
			form.add_error("opponent", "You cannot challenge yourself.")
		if not form.errors:
			challenge.save()
			notify(challenge.opponent, challenge.challenger, "challenge", f"{challenge.challenger.gamer_tag} challenged you", f"/tournaments/{tournament.slug}/")
			messages.success(request, "Challenge sent.")
			return redirect("tournament_detail", slug=tournament.slug)
	return render(request, "tournaments/tournament_detail.html", {"tournament": tournament, "challenge_form": form})


@login_required
def challenge_action(request, challenge_id, action):
	challenge = get_object_or_404(Challenge, id=challenge_id)
	player = get_object_or_404(GamerProfile, user=request.user)
	if action not in ("accept", "decline", "cancel") or request.method != "POST" or (action in ("accept", "decline") and challenge.opponent != player) or (action == "cancel" and challenge.challenger != player):
		return HttpResponseForbidden("You cannot update this challenge.")
	challenge.status = {"accept": "Accepted", "decline": "Declined", "cancel": "Cancelled"}.get(action, "Pending")
	challenge.save(update_fields=("status",))
	if challenge.status == "Accepted":
		notify(challenge.challenger, player, "challenge", f"{player.gamer_tag} accepted your challenge", f"/tournaments/{challenge.tournament.slug}/" if challenge.tournament else "/tournaments/")
	return redirect("tournament_detail", slug=challenge.tournament.slug) if challenge.tournament else redirect("tournament_list")


@login_required
def match_result(request, match_id):
	match = get_object_or_404(TournamentMatch, id=match_id)
	player = get_object_or_404(GamerProfile, user=request.user)
	if player not in (match.player_one, match.player_two) and player != match.tournament.organizer:
		return HttpResponseForbidden("You cannot submit this result.")
	form = MatchResultForm(request.POST or None, instance=match)
	was_completed = match.status == "Completed" and match.winner_id
	registered_ids = set(TournamentRegistration.objects.filter(tournament=match.tournament, status="Registered").values_list("player_id", flat=True))
	valid_players = {player_id for player_id in (match.player_one_id, match.player_two_id) if player_id}
	if form.is_valid() and was_completed:
		form.add_error(None, "This match already has a recorded result.")
	if form.is_valid() and not was_completed and not valid_players.issubset(registered_ids):
		form.add_error(None, "Both match players must be registered in this tournament.")
	if form.is_valid() and not was_completed and match.game_id != match.tournament.game_id:
		form.add_error(None, "This match must use the tournament game.")
	if form.is_valid() and not was_completed and valid_players.issubset(registered_ids) and match.game_id == match.tournament.game_id:
		match = form.save()
		_advance_winner(match)
		if match.status == "Completed" and match.winner:
			notify(match.winner, player, "match", f"You advanced in {match.tournament.name}", f"/tournaments/{match.tournament.slug}/")
			if not match.next_match:
				GamerProfile.objects.filter(id=match.winner_id).update(tournament_wins=F("tournament_wins") + 1)
				match.tournament.status = "Completed"
				match.tournament.save(update_fields=("status",))
		return redirect("tournament_detail", slug=match.tournament.slug)
	return render(request, "tournaments/match_form.html", {"form": form, "match": match, "tournament": match.tournament})

@login_required
def match_create(request, slug):
	tournament = get_object_or_404(Tournament, slug=slug, organizer__user=request.user)
	form = MatchCreateForm(request.POST or None)
	if form.is_valid():
		match = form.save(commit=False)
		match.tournament = tournament
		registered_ids = set(TournamentRegistration.objects.filter(tournament=tournament, status="Registered").values_list("player_id", flat=True))
		if match.player_one_id not in registered_ids or match.player_two_id not in registered_ids:
			form.add_error(None, "Both match players must be registered in this tournament.")
		elif match.game_id != tournament.game_id:
			form.add_error("game", "Matches must use this tournament's game.")
		else:
			match.save()
			messages.success(request, "Match scheduled.")
			return redirect("tournament_detail", slug=slug)
	return render(request, "tournaments/match_form.html", {"form": form, "match": None, "tournament": tournament})

# Create your views here.
