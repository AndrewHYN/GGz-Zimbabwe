from django.shortcuts import get_object_or_404, render
from django.db.models import Q, Count, Case, When, IntegerField
from django.core.paginator import Paginator, EmptyPage

from marketplace.models import Listing
from accounts.models import Block, GamerProfile
from tournaments.models import Tournament, TournamentMatch

from .models import Game


def _compute_game_stats(game):
	"""Return (profile, wins, matches, win_rate) for players with at least one valid completed match."""
	stats = []
	for profile in game.players.all().order_by("gamer_tag"):
		matches = 0
		wins = 0
		completed_matches = TournamentMatch.objects.filter(
			game=game,
			status="Completed",
		).filter(
			Q(player_one=profile) | Q(player_two=profile)
		).select_related("player_one", "player_two", "winner")

		for match in completed_matches:
			if match.player_one_id is None or match.player_two_id is None:
				continue
			valid_winners = {match.player_one_id, match.player_two_id}
			if match.winner_id not in valid_winners:
				continue
			matches += 1
			if match.winner_id == profile.id:
				wins += 1

		if matches == 0:
			continue

		win_rate = (wins / matches * 100) if matches else 0.0
		stats.append((profile, wins, matches, round(win_rate, 1)))

	return sorted(stats, key=lambda x: (-x[1], -x[2], -x[3], x[0].gamer_tag.lower()))


def game_list(request):
	games = Game.objects.order_by("name")
	return render(request, "games/game_list.html", {"games": games})


def game_detail(request, game_id):
	game = get_object_or_404(
		Game.objects.prefetch_related(
			"players__user",
			"posts__author__user",
			"posts__likes",
			"posts__comments",
		),
		id=game_id,
	)
	viewer = getattr(request.user, "gamer_profile", None)
	blocked_ids = {value for pair in Block.objects.filter(Q(blocker=viewer) | Q(blocked=viewer)).values_list("blocker_id", "blocked_id") for value in pair} if viewer else set()

	leaderboard = _compute_game_stats(game)[:10]

	return render(
		request,
		"games/game_detail.html",
		{
			"game": game,
			"available_players": game.players.filter(availability="Available"),
			"community_posts": game.posts.exclude(author_id__in=blocked_ids)[:5],
			"upcoming_tournaments": Tournament.objects.filter(game=game, status__in=("Registration Open", "Registration Closed")).select_related("organizer")[:4],
			"related_listings": Listing.objects.filter(game=game, status__in=("Available", "Reserved")).select_related("seller").prefetch_related("images")[:4],
			"leaderboard": leaderboard,
		},
	)


def game_leaderboard(request, game_id):
	game = get_object_or_404(Game.objects.prefetch_related("players__user"), id=game_id)
	leaderboard = _compute_game_stats(game)
	page_num = request.GET.get("page", 1)
	paginator = Paginator(leaderboard, 25)
	try:
		page_obj = paginator.page(page_num)
	except EmptyPage:
		page_obj = paginator.page(paginator.num_pages)
	return render(
		request,
		"games/game_leaderboard.html",
		{
			"game": game,
			"page": page_obj,
			"leaderboard": page_obj.object_list,
		},
	)
