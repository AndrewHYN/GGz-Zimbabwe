import math

import json
from collections import Counter

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import F, Q
from django.http import HttpResponseForbidden, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone

from events.models import Event, Organization
from games.models import Game

from .forms import CommentForm, GamerProfileForm, PostForm, SignupForm
from .models import Block, Comment, Conversation, ConversationParticipant, Follow, FriendRequest, Friendship, GamerProfile, Message, MessageRequest, Notification, Post, PostLike, Report, RespectTransaction, Venue, notify


def _notify(recipient, actor, notification_type, message, target_url=""):
	notify(recipient, actor, notification_type, message, target_url)


def _can_message(sender, recipient):
	if sender == recipient or Block.objects.filter(Q(blocker=sender, blocked=recipient) | Q(blocker=recipient, blocked=sender)).exists():
		return False
	first, second = sorted((sender.id, recipient.id))
	return Friendship.objects.filter(profile_one_id=first, profile_two_id=second).exists() or (Follow.objects.filter(follower=sender, following=recipient).exists() and Follow.objects.filter(follower=recipient, following=sender).exists()) or MessageRequest.objects.filter(Q(sender=sender, recipient=recipient) | Q(sender=recipient, recipient=sender), status="Accepted").exists()


def _distance_km(lat1, lon1, lat2, lon2):
	if None in (lat1, lon1, lat2, lon2):
		return None
	phi1 = math.radians(lat1)
	phi2 = math.radians(lat2)
	delta_phi = math.radians(lat2 - lat1)
	delta_lambda = math.radians(lon2 - lon1)
	a = (
		math.sin(delta_phi / 2) ** 2
		+ math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
	)
	return 6371.0 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _map_hotspot_payload():
	min_threshold = getattr(settings, "GGZ_MAP_MIN_HOTSPOT_GAMERS", 3)
	profiles = GamerProfile.objects.filter(location_public=True, latitude__isnull=False, longitude__isnull=False).prefetch_related("games")
	clusters = {}
	for profile in profiles:
		if profile.latitude is None or profile.longitude is None:
			continue
		key = (round(float(profile.latitude), 2), round(float(profile.longitude), 2))
		bucket = clusters.setdefault(key, {"latitude": key[0], "longitude": key[1], "gamer_count": 0, "games": []})
		bucket["gamer_count"] += 1
		bucket["games"].extend(game.name for game in profile.games.all())
	hotspots = []
	for data in clusters.values():
		if data["gamer_count"] < min_threshold:
			continue
		popular_games = [name for name, _ in Counter(data["games"]).most_common(5)]
		hotspots.append({
			"latitude": data["latitude"],
			"longitude": data["longitude"],
			"gamer_count": data["gamer_count"],
			"popular_games": popular_games,
			"label": "Gamer Hotspot",
		})
	return sorted(hotspots, key=lambda item: (-item["gamer_count"], item["latitude"], item["longitude"]))


def _map_entity_payload(model, queryset, kind, item_name_field="name"):
	items = []
	for item in queryset:
		lat = getattr(item, "latitude", None)
		lng = getattr(item, "longitude", None)
		if lat is None or lng is None:
			continue
		payload = {
			"id": item.pk,
			"kind": kind,
			"name": getattr(item, item_name_field),
			"latitude": float(lat),
			"longitude": float(lng),
			"location": getattr(item, "location", "") or getattr(item, "city", "") or getattr(item, "address", "") or "Public location",
		}
		if hasattr(item, "game") and getattr(item, "game", None):
			payload["game"] = item.game.name
			payload["game_id"] = item.game_id
		if hasattr(item, "status"):
			payload["status"] = item.status
		if hasattr(item, "url_name"):
			payload["url"] = reverse(item.url_name, args=[item.pk]) if kind != "organization" else reverse("event_list")
		else:
			payload["url"] = "#"
		items.append(payload)
	return items


def map_data(request):
	venues = Venue.objects.filter(latitude__isnull=False, longitude__isnull=False).exclude(latitude=0, longitude=0).order_by("name")
	venues_payload = [{
		"id": item.pk,
		"kind": "venue",
		"name": item.name,
		"latitude": float(item.latitude),
		"longitude": float(item.longitude),
		"category": item.category,
		"location": item.city or item.province or item.country or item.address or "Public location",
		"url": "#",
	} for item in venues]
	events = Event.objects.filter(location_public=True, latitude__isnull=False, longitude__isnull=False).exclude(latitude=0, longitude=0).select_related("game").order_by("start_date")
	event_payload = [{
		"id": item.pk,
		"kind": "event",
		"name": item.name,
		"latitude": float(item.latitude),
		"longitude": float(item.longitude),
		"location": item.location or item.city or item.country or "Public location",
		"status": item.status,
		"game": item.game.name if item.game else "General",
		"url": reverse("event_detail", args=[item.pk]),
	} for item in events]
	tournaments = Event.objects.none()
	from tournaments.models import Tournament
	tournaments = Tournament.objects.filter(latitude__isnull=False, longitude__isnull=False).exclude(latitude=0, longitude=0).select_related("game").order_by("start_date")
	tournament_payload = [{
		"id": item.pk,
		"kind": "tournament",
		"name": item.name,
		"latitude": float(item.latitude),
		"longitude": float(item.longitude),
		"location": item.location or item.city or item.country or "Public location",
		"status": item.status,
		"game": item.game.name if item.game else "General",
		"url": reverse("tournament_detail", args=[item.slug]),
	} for item in tournaments]
	organizations = Organization.objects.filter(location_public=True, latitude__isnull=False, longitude__isnull=False).exclude(latitude=0, longitude=0).order_by("name")
	organization_payload = [{
		"id": item.pk,
		"kind": "organization",
		"name": item.name,
		"latitude": float(item.latitude),
		"longitude": float(item.longitude),
		"location": item.city or item.province or item.country or item.address or "Public location",
		"organization_type": item.organization_type,
		"url": "#",
	} for item in organizations]

	payload = {
		"hotspots": _map_hotspot_payload(),
		"venues": venues_payload,
		"events": event_payload,
		"tournaments": tournament_payload,
		"organizations": organization_payload,
	}
	return JsonResponse(payload)


def map_page(request):
	provider = getattr(settings, "GGZ_MAP_PROVIDER", "osm")
	api_key = getattr(settings, "GGZ_MAP_API_KEY", "")
	default_lat = getattr(settings, "GGZ_MAP_DEFAULT_LATITUDE", -17.8252)
	default_lng = getattr(settings, "GGZ_MAP_DEFAULT_LONGITUDE", 31.0335)
	return render(
		request,
		"accounts/map_page.html",
		{
			"map_provider": provider,
			"map_api_key": api_key,
			"map_default_lat": default_lat,
			"map_default_lng": default_lng,
			"map_data_url": reverse("map_data"),
			"min_hotspot_gamers": getattr(settings, "GGZ_MAP_MIN_HOTSPOT_GAMERS", 3),
		},
	)


def geo_discovery(request):
	query = request.GET.get("q", "").strip()
	lat = request.GET.get("lat", "").strip()
	lng = request.GET.get("lng", "").strip()
	radius_km = float(request.GET.get("radius", "50") or 50)
	platform = request.GET.get("platform", "").strip()
	rank = request.GET.get("rank", "").strip()
	availability = request.GET.get("availability", "").strip()
	game_id = request.GET.get("game", "").strip()
	category = request.GET.get("category", "").strip()
	tournament_mode = request.GET.get("tournament_mode", "").strip()

	profiles = GamerProfile.objects.select_related("user").prefetch_related("games").filter(location_public=True)
	if query:
		profiles = profiles.filter(
			Q(gamer_tag__icontains=query)
			| Q(user__username__icontains=query)
			| Q(location__icontains=query)
			| Q(city__icontains=query)
			| Q(province__icontains=query)
			| Q(country__icontains=query)
		)
	if platform:
		profiles = profiles.filter(platform=platform)
	if rank:
		profiles = profiles.filter(rank=rank)
	if availability:
		profiles = profiles.filter(availability=availability)
	if game_id:
		profiles = profiles.filter(games__id=game_id)

	viewer = getattr(request.user, "gamer_profile", None)
	if viewer:
		blocked_ids = Block.objects.filter(Q(blocker=viewer) | Q(blocked=viewer)).values_list("blocker_id", "blocked_id")
		blocked_profile_ids = {value for pair in blocked_ids for value in pair}
		profiles = profiles.exclude(id__in=blocked_profile_ids)

	if lat and lng:
		lat_value = float(lat)
		lng_value = float(lng)
		filtered_profiles = []
		for profile in profiles:
			if profile.latitude is None or profile.longitude is None:
				continue
			distance = _distance_km(lat_value, lng_value, profile.latitude, profile.longitude)
			if distance is not None and distance <= radius_km:
				profile.distance_km = round(distance, 1)
				profile.distance_label = f"{profile.distance_km:.1f} km away"
				filtered_profiles.append(profile)
		profiles = sorted(filtered_profiles, key=lambda item: item.distance_km)
	else:
		profiles = list(profiles.order_by("gamer_tag"))
		for profile in profiles:
			profile.distance_label = "Location shared"

	venues = Venue.objects.all()
	if query:
		venues = venues.filter(Q(name__icontains=query) | Q(city__icontains=query) | Q(province__icontains=query) | Q(address__icontains=query) | Q(description__icontains=query))
	if category:
		venues = venues.filter(category=category)
	if lat and lng:
		lat_value = float(lat)
		lng_value = float(lng)
		filtered_venues = []
		for venue in venues:
			if venue.latitude is None or venue.longitude is None:
				continue
			distance = _distance_km(lat_value, lng_value, venue.latitude, venue.longitude)
			if distance is not None and distance <= radius_km:
				venue.distance_km = round(distance, 1)
				venue.distance_label = f"{venue.distance_km:.1f} km away"
				filtered_venues.append(venue)
		venues = sorted(filtered_venues, key=lambda item: item.distance_km)
	else:
		venues = list(venues.order_by("city", "name")[:12])
		for venue in venues:
			venue.distance_label = "Location shared"

	from tournaments.models import Tournament

	events = Event.objects.select_related("game", "organizer__user", "venue").filter(status__in=("Upcoming", "Live"))
	if query:
		events = events.filter(Q(name__icontains=query) | Q(location__icontains=query) | Q(venue__name__icontains=query) | Q(venue__city__icontains=query))
	if lat and lng:
		lat_value = float(lat)
		lng_value = float(lng)
		filtered_events = []
		for event in events:
			if event.mode == "online":
				event.distance_label = "Online event"
				filtered_events.append(event)
				continue
			if event.venue and event.venue.latitude is not None and event.venue.longitude is not None:
				distance = _distance_km(lat_value, lng_value, event.venue.latitude, event.venue.longitude)
				if distance is not None and distance <= radius_km:
					event.distance_km = round(distance, 1)
					event.distance_label = f"{event.distance_km:.1f} km away"
					filtered_events.append(event)
		nearby_events = sorted(filtered_events, key=lambda item: getattr(item, "distance_km", 9999))[:6]
	else:
		nearby_events = list(events.order_by("start_date")[:6])
		for event in nearby_events:
			event.distance_label = "Online event" if event.mode == "online" else "Location shared"

	tournaments = Tournament.objects.select_related("game", "organizer__user", "venue").filter(status__in=("Registration Open", "Live", "Registration Closed"))
	if query:
		tournaments = tournaments.filter(Q(name__icontains=query) | Q(location__icontains=query) | Q(city__icontains=query) | Q(province__icontains=query) | Q(venue__name__icontains=query))
	if tournament_mode:
		tournaments = tournaments.filter(mode=tournament_mode)
	if game_id:
		tournaments = tournaments.filter(game_id=game_id)
	if lat and lng:
		lat_value = float(lat)
		lng_value = float(lng)
		filtered_tournaments = []
		for tournament in tournaments:
			if tournament.mode == "online":
				tournament.distance_label = "Online tournament"
				filtered_tournaments.append(tournament)
				continue
			if tournament.latitude is not None and tournament.longitude is not None:
				distance = _distance_km(lat_value, lng_value, tournament.latitude, tournament.longitude)
				if distance is not None and distance <= radius_km:
					tournament.distance_km = round(distance, 1)
					tournament.distance_label = f"{tournament.distance_km:.1f} km away"
					filtered_tournaments.append(tournament)
		nearby_tournaments = sorted(filtered_tournaments, key=lambda item: getattr(item, "distance_km", 9999))[:6]
	else:
		nearby_tournaments = list(tournaments.order_by("start_date")[:6])
		for tournament in nearby_tournaments:
			tournament.distance_label = "Online tournament" if tournament.mode == "online" else "Location shared"

	page = Paginator(profiles, 12)
	page_obj = page.get_page(request.GET.get("page"))
	map_embed_url = ""
	if lat and lng:
		map_embed_url = f"https://www.openstreetmap.org/export/embed.html?bbox={float(lng)-0.05}%2C{float(lat)-0.05}%2C{float(lng)+0.05}%2C{float(lat)+0.05}&layer=mapnik&marker={float(lat)}%2C{float(lng)}"

	return render(
		request,
		"accounts/geo_discovery.html",
		{
			"page": page_obj,
			"query": query,
			"lat": lat,
			"lng": lng,
			"radius": radius_km,
			"nearby_events": nearby_events,
			"nearby_tournaments": nearby_tournaments,
			"venues": venues,
			"map_embed_url": map_embed_url,
			"platform_choices": GamerProfile.PLATFORM_CHOICES,
			"rank_choices": GamerProfile.RANK_CHOICES,
			"availability_choices": GamerProfile.AVAILABILITY_CHOICES,
			"game_choices": Game.objects.order_by("name"),
			"venue_category_choices": Venue.CATEGORY_CHOICES,
			"selected_platform": platform,
			"selected_rank": rank,
			"selected_availability": availability,
			"selected_game": game_id,
			"selected_category": category,
			"selected_tournament_mode": tournament_mode,
		},
	)


def gamer_discovery(request):
	profiles = GamerProfile.objects.select_related("user").prefetch_related("games")
	query = request.GET.get("q", "").strip()
	location = request.GET.get("location", "").strip()
	platform = request.GET.get("platform", "").strip()
	rank = request.GET.get("rank", "").strip()
	availability = request.GET.get("availability", "").strip()
	game_id = request.GET.get("game", "").strip()

	if query:
		profiles = profiles.filter(
			Q(gamer_tag__icontains=query) | Q(user__username__icontains=query)
		)
	if location:
		profiles = profiles.filter(location__icontains=location)
	if platform:
		profiles = profiles.filter(platform=platform)
	if rank:
		profiles = profiles.filter(rank=rank)
	if availability:
		profiles = profiles.filter(availability=availability)
	if game_id:
		profiles = profiles.filter(games__id=game_id)
	viewer = getattr(request.user, "gamer_profile", None)
	if viewer:
		blocked_ids = Block.objects.filter(Q(blocker=viewer) | Q(blocked=viewer)).values_list("blocker_id", "blocked_id")
		profiles = profiles.exclude(id__in={value for pair in blocked_ids for value in pair})

	page = Paginator(profiles.order_by("gamer_tag"), 12).get_page(
		request.GET.get("page")
	)
	return render(
		request,
		"accounts/gamer_discovery.html",
		{
			"page": page,
			"query": query,
			"location": location,
			"platform_choices": GamerProfile.PLATFORM_CHOICES,
			"rank_choices": GamerProfile.RANK_CHOICES,
			"availability_choices": GamerProfile.AVAILABILITY_CHOICES,
			"game_choices": Game.objects.order_by("name"),
		},
	)


@login_required
def dashboard(request):
	profile = getattr(request.user, "gamer_profile", None)
	return render(
		request,
		"accounts/dashboard.html",
		{
			"profile": profile,
			"game_count": profile.games.count() if profile else 0,
			"gamer_count": GamerProfile.objects.exclude(user=request.user).count(),
		},
	)


def _profile_connection_list(profile, relation_name):
	if relation_name == "followers":
		return GamerProfile.objects.filter(following__following=profile).select_related("user").prefetch_related("games").order_by("gamer_tag")
	if relation_name == "following":
		return GamerProfile.objects.filter(followers__follower=profile).select_related("user").prefetch_related("games").order_by("gamer_tag")
	if relation_name == "friends":
		return GamerProfile.objects.filter(
			Q(friendships_as_one__profile_two=profile) | Q(friendships_as_two__profile_one=profile)
		).select_related("user").prefetch_related("games").order_by("gamer_tag").distinct()
	return GamerProfile.objects.none()


def profile_detail(request, gamer_tag):
	profile = get_object_or_404(
		GamerProfile.objects.select_related("user").prefetch_related("games", "posts__game"),
		gamer_tag=gamer_tag,
	)
	viewer = getattr(request.user, "gamer_profile", None)
	friendship = None
	friend_request = None
	is_following = False
	is_blocked = False
	message_request = None
	message_request_incoming = None
	profile_posts = profile.posts.all()
	if viewer and viewer != profile:
		first, second = sorted((viewer.id, profile.id))
		friendship = Friendship.objects.filter(
			profile_one_id=first, profile_two_id=second
		).first()
		friend_request = FriendRequest.objects.filter(
			Q(sender=viewer, receiver=profile) | Q(sender=profile, receiver=viewer),
			status="pending",
		).first()
		is_following = Follow.objects.filter(follower=viewer, following=profile).exists()
		is_blocked = Block.objects.filter(Q(blocker=viewer, blocked=profile) | Q(blocker=profile, blocked=viewer)).exists()
		message_request = MessageRequest.objects.filter(sender=viewer, recipient=profile).first()
		message_request_incoming = MessageRequest.objects.filter(sender=profile, recipient=viewer).first()
		if is_blocked:
			profile_posts = Post.objects.none()

	from games.views import _compute_game_stats
	game_stats = []
	for game in profile.games.all():
		leaderboard = _compute_game_stats(game)
		player_entry = next((entry for entry in leaderboard if entry[0].id == profile.id), None)
		if not player_entry:
			continue
		position = next((index + 1 for index, entry in enumerate(leaderboard) if entry[0].id == profile.id), None)
		profile_wins = player_entry[1]
		profile_matches = player_entry[2]
		profile_win_rate = player_entry[3]
		game_stats.append({
			"game": game,
			"wins": profile_wins,
			"matches": profile_matches,
			"win_rate": profile_win_rate,
			"leaderboard_position": position,
		})

	return render(
		request,
		"accounts/profile_detail.html",
		{
			"profile": profile,
			"friendship": friendship,
			"friend_request": friend_request,
			"is_following": is_following,
			"is_blocked": is_blocked,
			"message_request": message_request,
			"message_request_incoming": message_request_incoming,
			"profile_posts": profile_posts,
			"follower_count": profile.followers.count(),
			"following_count": profile.following.count(),
			"friend_count": Friendship.objects.filter(
				Q(profile_one=profile) | Q(profile_two=profile)
			).count(),
			"respect_giver_count": profile.respect_received.count(),
			"game_stats": game_stats,
		},
	)


def profile_followers(request, gamer_tag):
	profile = get_object_or_404(GamerProfile.objects.select_related("user"), gamer_tag=gamer_tag)
	items = _profile_connection_list(profile, "followers")
	return render(request, "accounts/profile_connections.html", {"profile": profile, "items": items, "mode": "followers", "title": f"{profile.gamer_tag}'s followers"})


def profile_following(request, gamer_tag):
	profile = get_object_or_404(GamerProfile.objects.select_related("user"), gamer_tag=gamer_tag)
	items = _profile_connection_list(profile, "following")
	return render(request, "accounts/profile_connections.html", {"profile": profile, "items": items, "mode": "following", "title": f"{profile.gamer_tag} is following"})


def profile_friends(request, gamer_tag):
	profile = get_object_or_404(GamerProfile.objects.select_related("user"), gamer_tag=gamer_tag)
	items = _profile_connection_list(profile, "friends")
	return render(request, "accounts/profile_connections.html", {"profile": profile, "items": items, "mode": "friends", "title": f"{profile.gamer_tag}'s friends"})


def player_match_history(request, gamer_tag):
	"""Show completed matches for a player, ordered by date (most recent first)."""
	profile = get_object_or_404(GamerProfile.objects.select_related("user"), gamer_tag=gamer_tag)

	from games.views import _compute_game_stats
	from tournaments.models import TournamentMatch
	matches = TournamentMatch.objects.filter(
		status="Completed",
	).filter(
		Q(player_one=profile) | Q(player_two=profile)
	).select_related(
		"game",
		"tournament",
		"player_one__user",
		"player_two__user",
		"winner__user",
	).order_by("-scheduled_at", "-created_at")

	profile_game_record = {}
	for game in profile.games.all():
		stats = _compute_game_stats(game)
		profile_stat = next((entry for entry in stats if entry[0].id == profile.id), None)
		if profile_stat:
			profile_game_record[game.id] = {
				"wins": profile_stat[1],
				"matches": profile_stat[2],
				"win_rate": profile_stat[3],
			}

	match_data = []
	for match in matches:
		if match.player_one_id is None or match.player_two_id is None:
			continue
		valid_winners = {match.player_one_id, match.player_two_id}
		if match.winner_id not in valid_winners:
			continue
		opponent = match.player_two if match.player_one_id == profile.id else match.player_one
		won = match.winner_id == profile.id
		record = profile_game_record.get(match.game_id, {"wins": 0, "matches": 0, "win_rate": 0})
		match_data.append({
			"match": match,
			"opponent": opponent,
			"won": won,
			"result_label": "Win" if won else "Loss",
			"score": match.score or "No score recorded",
			"record": record,
			"record_label": f"{record['wins']}-{record['matches'] - record['wins']} ({record['win_rate']}%)",
		})

	return render(
		request,
		"accounts/player_match_history.html",
		{
			"profile": profile,
			"match_data": match_data,
			"match_count": len(match_data),
		},
	)


@login_required
def connection_action(request, gamer_tag, action):
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	target = get_object_or_404(GamerProfile, gamer_tag=gamer_tag)
	viewer = get_object_or_404(GamerProfile, user=request.user)
	if target == viewer:
		return HttpResponseForbidden("You cannot interact with your own profile.")
	if action == "follow":
		if not Block.objects.filter(Q(blocker=target, blocked=viewer) | Q(blocker=viewer, blocked=target)).exists():
			created = Follow.objects.get_or_create(follower=viewer, following=target)[1]
			if created:
				_notify(target, viewer, "follow", f"{viewer.gamer_tag} followed you", f"/profiles/{viewer.gamer_tag}/")
	elif action == "unfollow":
		Follow.objects.filter(follower=viewer, following=target).delete()
	elif action == "friend":
		if not Block.objects.filter(
			Q(blocker=target, blocked=viewer) | Q(blocker=viewer, blocked=target)
		).exists():
			FriendRequest.objects.update_or_create(
				sender=viewer, receiver=target,
				defaults={"status": "pending"},
			)
			_notify(target, viewer, "friend_request", f"{viewer.gamer_tag} sent you a friend request", f"/profiles/{viewer.gamer_tag}/")
	elif action in {"cancel", "reject"}:
		FriendRequest.objects.filter(
			sender=viewer if action == "cancel" else target,
			receiver=target if action == "cancel" else viewer,
			status="pending",
		).update(status="cancelled" if action == "cancel" else "rejected")
	elif action == "accept":
		friend_request = get_object_or_404(
			FriendRequest, sender=target, receiver=viewer, status="pending"
		)
		first, second = sorted((viewer.id, target.id))
		Friendship.objects.get_or_create(profile_one_id=first, profile_two_id=second)
		friend_request.delete()
		_notify(target, viewer, "friend_accept", f"{viewer.gamer_tag} accepted your friend request", f"/profiles/{viewer.gamer_tag}/")
	elif action == "remove":
		first, second = sorted((viewer.id, target.id))
		Friendship.objects.filter(profile_one_id=first, profile_two_id=second).delete()
	elif action == "block":
		Block.objects.get_or_create(blocker=viewer, blocked=target)
		Follow.objects.filter(
			Q(follower=viewer, following=target) | Q(follower=target, following=viewer)
		).delete()
		FriendRequest.objects.filter(
			Q(sender=viewer, receiver=target) | Q(sender=target, receiver=viewer)
		).delete()
		first, second = sorted((viewer.id, target.id))
		Friendship.objects.filter(profile_one_id=first, profile_two_id=second).delete()
	elif action == "unblock":
		Block.objects.filter(blocker=viewer, blocked=target).delete()
	elif action == "respect":
		if Block.objects.filter(
			Q(blocker=target, blocked=viewer) | Q(blocker=viewer, blocked=target)
		).exists():
			return HttpResponseForbidden("Blocked users cannot exchange respect.")
		created = RespectTransaction.objects.get_or_create(
			giver=viewer, recipient=target
		)[1]
		if created:
			GamerProfile.objects.filter(id=target.id).update(
				respect_points=F("respect_points") + 1
			)
			_notify(target, viewer, "respect", f"{viewer.gamer_tag} gave you Respect", f"/profiles/{viewer.gamer_tag}/")
	elif action == "report":
		Report.objects.get_or_create(reporter=viewer, reported_profile=target)
	else:
		return HttpResponseForbidden("Unknown connection action.")
	messages.success(request, "Your community action was updated.")
	if request.headers.get("x-requested-with") == "XMLHttpRequest":
		return JsonResponse({"ok": True, "action": action})
	return redirect("profile_detail", gamer_tag=target.gamer_tag)


def _visible_posts(viewer):
	posts = Post.objects.select_related("author__user", "game").prefetch_related("likes", "comments__author")
	if viewer:
		blocked_ids = Block.objects.filter(
			Q(blocker=viewer) | Q(blocked=viewer)
		).values_list("blocker_id", "blocked_id")
		blocked_profile_ids = set()
		for blocker_id, blocked_id in blocked_ids:
			blocked_profile_ids.update((blocker_id, blocked_id))
		posts = posts.exclude(author_id__in=blocked_profile_ids)
	return posts


def feed(request):
	viewer = getattr(request.user, "gamer_profile", None)
	posts = _visible_posts(viewer)
	tab = request.GET.get("tab", "latest")
	if tab == "following" and viewer:
		posts = posts.filter(author__in=viewer.following.all())
	elif tab == "for-you" and viewer:
		posts = posts.filter(
			Q(author__location=viewer.location) | Q(author__games__in=viewer.games.all())
		).distinct()
	page = Paginator(posts, 10).get_page(request.GET.get("page"))
	liked_post_ids = set(PostLike.objects.filter(user=viewer, post__in=page.object_list).values_list("post_id", flat=True)) if viewer else set()
	return render(request, "accounts/feed.html", {"page": page, "tab": tab, "post_form": PostForm(), "liked_post_ids": liked_post_ids})


@login_required
def post_create(request):
	if request.method != "POST":
		return redirect("feed")
	form = PostForm(request.POST, request.FILES)
	if form.is_valid():
		post = form.save(commit=False)
		post.author = get_object_or_404(GamerProfile, user=request.user)
		post.save()
		_notify(post.author, get_object_or_404(GamerProfile, user=request.user), "post", f"{post.author.gamer_tag} published a post", f"/feed/posts/{post.id}/")
		messages.success(request, "Your post is live in the community feed.")
	return redirect("feed")


@login_required
def post_edit(request, post_id):
	post = get_object_or_404(Post, id=post_id, author__user=request.user)
	form = PostForm(request.POST or None, request.FILES or None, instance=post)
	if form.is_valid():
		form.save()
		messages.success(request, "Your post was updated.")
		return redirect("post_detail", post_id=post.id)
	return render(request, "accounts/post_edit.html", {"form": form, "post": post})


@login_required
def post_delete(request, post_id):
	post = get_object_or_404(Post, id=post_id, author__user=request.user)
	if request.method == "POST":
		post.delete()
		messages.success(request, "Your post was deleted.")
	return redirect("feed")


def post_detail(request, post_id):
	post = get_object_or_404(_visible_posts(getattr(request.user, "gamer_profile", None)), id=post_id)
	form = CommentForm(request.POST or None)
	if request.method == "POST" and request.user.is_authenticated:
		if form.is_valid():
			comment = form.save(commit=False)
			comment.post = post
			comment.author = get_object_or_404(GamerProfile, user=request.user)
			if Block.objects.filter(Q(blocker=comment.author, blocked=post.author) | Q(blocker=post.author, blocked=comment.author)).exists():
				return redirect("post_detail", post_id=post.id)
			comment.save()
			if comment.post.author != comment.author:
				_notify(comment.post.author, comment.author, "comment", f"{comment.author.gamer_tag} commented on your post", f"/feed/posts/{comment.post.id}/")
			return redirect("post_detail", post_id=post.id)
	viewer = getattr(request.user, "gamer_profile", None)
	liked_post_ids = {post.id} if viewer and PostLike.objects.filter(post=post, user=viewer).exists() else set()
	return render(request, "accounts/post_detail.html", {"post": post, "comment_form": form, "liked_post_ids": liked_post_ids})


@login_required
def post_like(request, post_id):
	post = get_object_or_404(_visible_posts(getattr(request.user, "gamer_profile", None)), id=post_id)
	if request.method == "POST":
		profile = get_object_or_404(GamerProfile, user=request.user)
		like, created = PostLike.objects.get_or_create(post=post, user=profile)
		if not created:
			like.delete()
		elif post.author != profile:
			_notify(post.author, profile, "like", f"{profile.gamer_tag} liked your post", f"/feed/posts/{post.id}/")
	if request.headers.get("x-requested-with") == "XMLHttpRequest":
		return JsonResponse({"ok": True, "liked": created, "count": post.likes.count()})
	return redirect(request.POST.get("next") or "feed")


@login_required
def post_report(request, post_id):
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	post = get_object_or_404(_visible_posts(getattr(request.user, "gamer_profile", None)), id=post_id)
	reporter = get_object_or_404(GamerProfile, user=request.user)
	Report.objects.get_or_create(reporter=reporter, post=post)
	return redirect("post_detail", post_id=post.id)


@login_required
def notification_list(request):
	profile = get_object_or_404(GamerProfile, user=request.user)
	notifications = profile.notifications.all()
	return render(request, "accounts/notification_list.html", {"notifications": notifications, "unread_count": notifications.filter(is_read=False).count()})


@login_required
def notification_read(request, notification_id):
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	profile = get_object_or_404(GamerProfile, user=request.user)
	notification = get_object_or_404(Notification, id=notification_id, recipient=profile)
	notification.is_read = True
	notification.save(update_fields=("is_read",))
	return redirect(notification.target_url or "notification_list")


@login_required
def notification_unread(request, notification_id):
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	profile = get_object_or_404(GamerProfile, user=request.user)
	Notification.objects.filter(id=notification_id, recipient=profile).update(is_read=False)
	return redirect("notification_list")


@login_required
def notifications_read_all(request):
	if request.method == "POST":
		Notification.objects.filter(recipient__user=request.user, is_read=False).update(is_read=True)
	return redirect("notification_list")


@login_required
def conversation_list(request):
	profile = get_object_or_404(GamerProfile, user=request.user)
	conversations = Conversation.objects.filter(participants=profile).prefetch_related("participants", "messages", "participant_links")
	for conversation in conversations:
		conversation.other = conversation.participants.exclude(id=profile.id).first()
		participant = conversation.participant_links.get(profile=profile)
		visible_messages = conversation.messages.filter(created_at__gt=participant.cleared_at) if participant.cleared_at else conversation.messages.all()
		conversation.last_message = visible_messages.last()
		unread_messages = visible_messages.exclude(sender=profile)
		conversation.unread_count = unread_messages.filter(created_at__gt=participant.last_read_at).count() if participant.last_read_at else unread_messages.count()
	return render(request, "accounts/conversation_list.html", {"conversations": conversations, "profile": profile})


@login_required
def conversation_detail(request, conversation_id):
	profile = get_object_or_404(GamerProfile, user=request.user)
	conversation = get_object_or_404(Conversation.objects.prefetch_related("participants", "messages__sender"), id=conversation_id, participants=profile)
	participant = get_object_or_404(ConversationParticipant, conversation=conversation, profile=profile)
	other = conversation.participants.exclude(id=profile.id).first()
	if other and Block.objects.filter(Q(blocker=profile, blocked=other) | Q(blocker=other, blocked=profile)).exists():
		return HttpResponseForbidden("You cannot access this conversation.")
	if request.method == "POST":
		if request.POST.get("action") == "clear":
			participant.cleared_at = timezone.now()
			participant.last_read_at = participant.cleared_at
			participant.save(update_fields=("cleared_at", "last_read_at"))
			messages.success(request, "Conversation cleared for you.")
			return redirect("conversation_detail", conversation_id=conversation.id)
		body = request.POST.get("body", "").strip()
		other = conversation.participants.exclude(id=profile.id).first()
		if body and other and _can_message(profile, other):
			Message.objects.create(conversation=conversation, sender=profile, body=body)
			conversation.save(update_fields=("updated_at",))
			_notify(other, profile, "message", f"{profile.gamer_tag} sent you a message", f"/messages/{conversation.id}/")
		return redirect("conversation_detail", conversation_id=conversation.id)
	ConversationParticipant.objects.filter(conversation=conversation, profile=profile).update(last_read_at=timezone.now())
	messages_qs = conversation.messages.filter(created_at__gt=participant.cleared_at) if participant.cleared_at else conversation.messages.all()
	return render(request, "accounts/conversation_detail.html", {"conversation": conversation, "profile": profile, "other": conversation.participants.exclude(id=profile.id).first(), "conversation_messages": messages_qs})


@login_required
def conversation_start(request, gamer_tag):
	profile = get_object_or_404(GamerProfile, user=request.user)
	other = get_object_or_404(GamerProfile, gamer_tag=gamer_tag)
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	if not _can_message(profile, other):
		return HttpResponseForbidden("You cannot message this gamer.")
	conversation = Conversation.objects.filter(participants=profile).filter(participants=other).first()
	if not conversation:
		conversation = Conversation.objects.create()
		ConversationParticipant.objects.bulk_create([ConversationParticipant(conversation=conversation, profile=profile), ConversationParticipant(conversation=conversation, profile=other)])
	return redirect("conversation_detail", conversation_id=conversation.id)


@login_required
def message_request_action(request, gamer_tag, action):
	if request.method != "POST" or action not in ("send", "accept", "decline", "delete"):
		return HttpResponseForbidden("Invalid message request action.")
	profile = get_object_or_404(GamerProfile, user=request.user)
	other = get_object_or_404(GamerProfile, gamer_tag=gamer_tag)
	if profile == other or Block.objects.filter(Q(blocker=profile, blocked=other) | Q(blocker=other, blocked=profile)).exists():
		return HttpResponseForbidden("You cannot message this player.")
	if action == "send":
		request_row = MessageRequest.objects.filter(sender=profile, recipient=other).first()
		created = request_row is None
		if created:
			request_row = MessageRequest.objects.create(sender=profile, recipient=other)
		elif request_row.status == "Declined":
			request_row.status = "Pending"
			request_row.save(update_fields=("status",))
		if created or request_row.status == "Pending":
			_notify(other, profile, "message_request", f"{profile.gamer_tag} sent you a message request", f"/profiles/{profile.gamer_tag}/")
	elif action == "delete":
		request_row = get_object_or_404(MessageRequest, Q(sender=profile, recipient=other) | Q(sender=other, recipient=profile))
		request_row.delete()
		return redirect("profile_detail", gamer_tag=other.gamer_tag)
	else:
		request_row = get_object_or_404(MessageRequest, sender=other, recipient=profile)
		if action == "accept":
			request_row.status = "Accepted"
			_notify(other, profile, "message_request", f"{profile.gamer_tag} accepted your message request", f"/profiles/{profile.gamer_tag}/")
		elif action == "decline":
			request_row.status = "Declined"
		else:
			request_row.delete()
			return redirect("profile_detail", gamer_tag=other.gamer_tag)
		request_row.save(update_fields=("status",))
	return redirect("profile_detail", gamer_tag=other.gamer_tag)


@login_required
def profile_edit(request, gamer_tag):
	profile = get_object_or_404(GamerProfile, gamer_tag=gamer_tag)
	if request.user != profile.user:
		return HttpResponseForbidden("You can only edit your own profile.")

	form = GamerProfileForm(
		request.POST or None,
		request.FILES or None,
		instance=profile,
	)
	if form.is_valid():
		updated_profile = form.save()
		return redirect("profile_detail", gamer_tag=updated_profile.gamer_tag)

	return render(
		request,
		"accounts/profile_edit.html",
		{"form": form, "profile": profile},
	)


def signup(request):
	form = SignupForm(request.POST or None)
	if form.is_valid():
		user = form.save()
		login(request, user)
		return redirect("profile_detail", gamer_tag=user.gamer_profile.gamer_tag)

	return render(request, "accounts/signup.html", {"form": form})
