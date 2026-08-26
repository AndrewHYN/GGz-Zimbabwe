from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.utils.text import slugify

from accounts.models import GamerProfile, Notification

from .forms import ChallengeForm, MatchCreateForm, MatchResultForm, TournamentForm
from .models import Challenge, Tournament, TournamentMatch, TournamentRegistration


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
	tournament = get_object_or_404(Tournament.objects.select_related("game", "organizer__user").prefetch_related("registrations__player", "matches__player_one", "matches__player_two"), slug=slug)
	player = getattr(request.user, "gamer_profile", None)
	registration = TournamentRegistration.objects.filter(tournament=tournament, player=player).first() if player else None
	return render(request, "tournaments/tournament_detail.html", {"tournament": tournament, "registration": registration, "challenge_form": ChallengeForm()})


@login_required
def tournament_my(request):
	profile = get_object_or_404(GamerProfile, user=request.user)
	tournaments = Tournament.objects.filter(organizer=profile).prefetch_related("registrations", "matches")
	return render(request, "tournaments/tournament_my.html", {"tournaments": tournaments})


@login_required
def tournament_manage(request, slug):
	tournament = get_object_or_404(Tournament.objects.prefetch_related("registrations__player", "matches__player_one", "matches__player_two"), slug=slug, organizer__user=request.user)
	return render(request, "tournaments/tournament_manage.html", {"tournament": tournament})


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
		Notification.objects.create(recipient=registration.player, notification_type="tournament", message=f"Your registration for {registration.tournament.name} was updated", target_url=f"/tournaments/{registration.tournament.slug}/")
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
	if tournament.participant_count >= tournament.max_participants:
		return HttpResponseForbidden("This tournament is full.")
	TournamentRegistration.objects.get_or_create(tournament=tournament, player=player, defaults={"status": "Registered"})
	Notification.objects.create(recipient=tournament.organizer, actor=player, notification_type="tournament", message=f"{player.gamer_tag} registered for {tournament.name}", target_url=f"/tournaments/{tournament.slug}/manage/")
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
		if challenge.opponent == challenge.challenger:
			form.add_error("opponent", "You cannot challenge yourself.")
		else:
			challenge.save()
			messages.success(request, "Challenge sent.")
			return redirect("tournament_detail", slug=tournament.slug)
	return render(request, "tournaments/tournament_detail.html", {"tournament": tournament, "challenge_form": form})


@login_required
def challenge_action(request, challenge_id, action):
	challenge = get_object_or_404(Challenge, id=challenge_id)
	player = get_object_or_404(GamerProfile, user=request.user)
	if request.method != "POST" or (action == "accept" and challenge.opponent != player) or (action == "cancel" and challenge.challenger != player):
		return HttpResponseForbidden("You cannot update this challenge.")
	challenge.status = {"accept": "Accepted", "decline": "Declined", "cancel": "Cancelled"}.get(action, "Pending")
	challenge.save(update_fields=("status",))
	return redirect("tournament_detail", slug=challenge.tournament.slug) if challenge.tournament else redirect("tournament_list")


@login_required
def match_result(request, match_id):
	match = get_object_or_404(TournamentMatch, id=match_id)
	player = get_object_or_404(GamerProfile, user=request.user)
	if player not in (match.player_one, match.player_two) and player != match.tournament.organizer:
		return HttpResponseForbidden("You cannot submit this result.")
	form = MatchResultForm(request.POST or None, instance=match)
	if form.is_valid():
		match = form.save()
		if match.status == "Completed" and match.winner and match.next_match:
			next_match = match.next_match
			if not next_match.player_one or next_match.player_one == match.player_one:
				next_match.player_one = match.winner
			else:
				next_match.player_two = match.winner
			next_match.save(update_fields=("player_one", "player_two"))
			Notification.objects.create(recipient=match.winner, notification_type="match", message=f"You advanced in {match.tournament.name}", target_url=f"/tournaments/{match.tournament.slug}/")
		return redirect("tournament_detail", slug=match.tournament.slug)
	return render(request, "tournaments/match_form.html", {"form": form, "match": match})

@login_required
def match_create(request, slug):
	tournament = get_object_or_404(Tournament, slug=slug, organizer__user=request.user)
	form = MatchCreateForm(request.POST or None)
	if form.is_valid():
		match = form.save(commit=False)
		match.tournament = tournament
		match.save()
		messages.success(request, "Match scheduled.")
		return redirect("tournament_detail", slug=slug)
	return render(request, "tournaments/match_form.html", {"form": form, "tournament": tournament})

# Create your views here.
