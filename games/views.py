from django.shortcuts import get_object_or_404, render

from marketplace.models import Listing
from tournaments.models import Tournament

from .models import Game


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
	return render(
		request,
		"games/game_detail.html",
		{
			"game": game,
			"available_players": game.players.filter(availability="Available"),
			"community_posts": game.posts.all()[:5],
			"upcoming_tournaments": Tournament.objects.filter(game=game, status__in=("Registration Open", "Registration Closed")).select_related("organizer")[:4],
			"related_listings": Listing.objects.filter(game=game, status__in=("Available", "Reserved")).select_related("seller").prefetch_related("images")[:4],
		},
	)
