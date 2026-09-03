from django.shortcuts import get_object_or_404, redirect, render
from django.db.models import Q, Count, Case, When, IntegerField
from django.core.paginator import Paginator, EmptyPage
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from marketplace.models import Listing
from accounts.models import Block, ExternalFeedItem, GamerProfile
from tournaments.models import Challenge, Tournament, TournamentMatch
from events.models import Event

from .models import Game, GameReview, GameWishlist


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


def _game_queryset():
	return Game.objects.order_by("-featured", "-popularity", "name")


def game_list(request):
	q = request.GET.get("q", "").strip()
	genre = request.GET.get("genre", "").strip()
	platform = request.GET.get("platform", "").strip()
	free_only = request.GET.get("free", "") == "1"
	featured_only = request.GET.get("featured", "") == "1"
	sort = request.GET.get("sort", "popular")
	games = _game_queryset()
	if q:
		games = games.filter(Q(name__icontains=q) | Q(description__icontains=q) | Q(developer__icontains=q) | Q(genre__icontains=q))
	if genre:
		games = games.filter(genre__icontains=genre)
	if platform:
		games = games.filter(platform__icontains=platform)
	if free_only:
		games = games.filter(free_to_play=True)
	if featured_only:
		games = games.filter(featured=True)
	if sort == "newest":
		games = games.order_by("-release_year", "name")
	elif sort == "alpha":
		games = games.order_by("name")
	elif sort == "popular":
		games = games.order_by("-popularity", "-featured", "name")
	elif sort == "release":
		games = games.order_by("-release_year", "-popularity", "name")
	featured_games = games.filter(featured=True)[:5]
	popular_games = games.filter(popularity__gt=0)[:8]
	free_games = games.filter(free_to_play=True)[:6]
	new_games = games.filter(release_year__isnull=False).order_by("-release_year")[:6]
	local_games = games.filter(local_developer=True)[:6]
	sponsored_games = games.filter(sponsored=True)[:6]
	categories = sorted({game.genre.strip() for game in games.exclude(genre="") if game.genre.strip()})
	platforms = sorted({game.platform.strip() for game in games.exclude(platform="") if game.platform.strip()})
	return render(
		request,
		"games/game_list.html",
		{
			"games": games,
			"featured_games": featured_games,
			"popular_games": popular_games,
			"free_games": free_games,
			"new_games": new_games,
			"local_games": local_games,
			"sponsored_games": sponsored_games,
			"categories": categories,
			"platforms": platforms,
			"query": q,
			"selected_genre": genre,
			"selected_platform": platform,
			"selected_sort": sort,
			"free_only": free_only,
			"featured_only": featured_only,
		},
	)


def game_detail(request, game_id):
	game = get_object_or_404(
		Game.objects.prefetch_related(
			"players__user",
			"posts__author__user",
			"posts__likes",
			"posts__comments",
			"reviews__reviewer__user",
		),
		id=game_id,
	)
	viewer = getattr(request.user, "gamer_profile", None)
	blocked_ids = {value for pair in Block.objects.filter(Q(blocker=viewer) | Q(blocked=viewer)).values_list("blocker_id", "blocked_id") for value in pair} if viewer else set()
	leaderboard = _compute_game_stats(game)[:10]
	available_players = game.players.select_related("user").order_by("gamer_tag")[:8]
	community_posts = game.posts.exclude(author_id__in=blocked_ids)[:5]
	game_news = ExternalFeedItem.objects.filter(game=game, is_active=True).order_by("-published_at")[:4]
	upcoming_tournaments = Tournament.objects.filter(game=game, status__in=("Registration Open", "Registration Closed", "Live")).select_related("organizer")[:4]
	related_events = Event.objects.filter(game=game, status__in=("Upcoming", "Published", "Live")).select_related("organizer")[:4]
	related_listings = Listing.objects.filter(game=game, status__in=("Available", "Reserved")).select_related("seller").prefetch_related("images")[:4]
	reviews = list(game.reviews.select_related("reviewer__user").order_by("-created_at"))
	user_review = next((review for review in reviews if viewer and review.reviewer_id == viewer.id), None)
	wishlist_count = GameWishlist.objects.filter(game=game).count()
	is_wishlisted = bool(viewer and GameWishlist.objects.filter(profile=viewer, game=game).exists())
	challenge_form = None
	if viewer:
		from tournaments.forms import ChallengeForm
		challenge_form = ChallengeForm(initial={"game": game.id, "opponent": ""})
	return render(
		request,
		"games/game_detail.html",
		{
			"game": game,
			"available_players": available_players,
			"community_posts": community_posts,
			"game_news": game_news,
			"upcoming_tournaments": upcoming_tournaments,
			"related_events": related_events,
			"related_listings": related_listings,
			"leaderboard": leaderboard,
			"viewer": viewer,
			"challenge_form": challenge_form,
			"store_label": game.store_label,
			"trailer_embed_url": game.trailer_embed_url,
			"store_links": game.acquisition_links,
			"primary_store_url": game.primary_store_url,
			"average_rating": game.average_rating,
			"review_count": game.review_count,
			"reviews": reviews,
			"user_review": user_review,
			"is_wishlisted": is_wishlisted,
			"wishlist_count": wishlist_count,
			"player_count": game.players.count(),
			"tournament_count": game.tournaments.filter(status__in=("Registration Open", "Registration Closed", "Live")).count(),
			"event_count": game.events.filter(status__in=("Upcoming", "Published", "Live")).count(),
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


@login_required
def game_challenge_create(request, game_id):
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	game = get_object_or_404(Game, id=game_id)
	profile = get_object_or_404(GamerProfile, user=request.user)
	opponent_id = request.POST.get("opponent")
	if not opponent_id:
		messages.error(request, "Choose a friend to challenge.")
		return redirect("game_detail", game_id=game.id)
	opponent = get_object_or_404(GamerProfile, id=opponent_id, games=game)
	if opponent == profile:
		messages.error(request, "You cannot challenge yourself.")
		return redirect("game_detail", game_id=game.id)
	scheduled_at = request.POST.get("scheduled_at") or None
	if scheduled_at:
		scheduled_dt = parse_datetime(scheduled_at)
		if scheduled_dt and timezone.is_naive(scheduled_dt):
			scheduled_dt = timezone.make_aware(scheduled_dt, timezone.get_current_timezone())
		scheduled_at = scheduled_dt
	challenge, created = Challenge.objects.get_or_create(
		challenger=profile,
		opponent=opponent,
		game=game,
		status="Pending",
		defaults={"scheduled_at": scheduled_at},
	)
	if not created:
		messages.info(request, "You already have a pending challenge for this player.")
		return redirect("game_detail", game_id=game.id)
	messages.success(request, "Challenge sent.")
	return redirect("game_detail", game_id=game.id)


@login_required
def game_review_create(request, game_id):
	game = get_object_or_404(Game, id=game_id)
	profile = get_object_or_404(GamerProfile, user=request.user)
	rating = request.POST.get("rating")
	review_text = (request.POST.get("review") or "").strip()
	if not rating:
		messages.error(request, "Select a rating before posting your review.")
		return redirect("game_detail", game_id=game.id)
	try:
		rating_value = int(rating)
	except (TypeError, ValueError):
		messages.error(request, "The submitted rating was invalid.")
		return redirect("game_detail", game_id=game.id)
	if rating_value not in {1, 2, 3, 4, 5}:
		messages.error(request, "The submitted rating was invalid.")
		return redirect("game_detail", game_id=game.id)
	review, created = GameReview.objects.get_or_create(game=game, reviewer=profile, defaults={"rating": rating_value, "review": review_text})
	review.rating = rating_value
	review.review = review_text
	review.save()
	if created:
		messages.success(request, "Review posted.")
	else:
		messages.success(request, "Review updated.")
	return redirect("game_detail", game_id=game.id)


@login_required
def game_wishlist_toggle(request, game_id):
	game = get_object_or_404(Game, id=game_id)
	profile = get_object_or_404(GamerProfile, user=request.user)
	wishlist_item = GameWishlist.objects.filter(game=game, profile=profile).first()
	if wishlist_item:
		wishlist_item.delete()
		messages.success(request, f"Removed {game.name} from your wishlist.")
	else:
		GameWishlist.objects.create(game=game, profile=profile)
		messages.success(request, f"Added {game.name} to your wishlist.")
	return redirect("game_detail", game_id=game.id)
