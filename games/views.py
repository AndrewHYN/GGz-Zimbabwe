from django.shortcuts import get_object_or_404, render
from django.db.models import Q, Count, Case, When, IntegerField
from django.core.paginator import Paginator, EmptyPage

from marketplace.models import Listing
from accounts.models import Block, GamerProfile
from tournaments.models import Tournament, TournamentMatch

from .models import Game


def _compute_game_stats(game):
	"""
	Return a list of (profile, wins, matches, win_rate) for all players of this game.
	Ranked by wins (descending), with win_rate as tiebreaker.
	Only counts completed matches where the player participated and won.
	"""
	stats = []
	for profile in game.players.all():
		# Count only completed matches where this player participated
		matches = TournamentMatch.objects.filter(
			game=game,
			status="Completed"
		).filter(
			Q(player_one=profile) | Q(player_two=profile)
		).count()

		# Count only wins in completed matches (and verify winner is this player)
		wins = TournamentMatch.objects.filter(
			game=game,
			status="Completed",
			winner=profile
		).filter(
			Q(player_one=profile) | Q(player_two=profile)
		).count()

		win_rate = (wins / matches * 100) if matches > 0 else 0.0
		stats.append((profile, wins, matches, round(win_rate, 1)))

	# Sort by wins descending, then by win_rate descending
	# Players with no matches are excluded from ranking
	return sorted([s for s in stats if s[1] > 0], key=lambda x: (-x[1], -x[3]))


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
