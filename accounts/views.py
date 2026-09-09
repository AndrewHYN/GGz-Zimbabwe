import json
import logging
import math
import re
import secrets
import time
from collections import Counter
from datetime import timedelta
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

import jwt
from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import AuthenticationForm, PasswordChangeForm, PasswordResetForm, SetPasswordForm
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core.paginator import Paginator
from django.db.models import Case, Count, Exists, F, IntegerField, OuterRef, Q, Subquery, Value, When
from django.http import FileResponse, HttpResponseForbidden, JsonResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils import timezone
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from botocore.exceptions import BotoCoreError, ClientError

from events.models import Event, Organization, OrganizationLocation, OrganizationLocationRating, OrganizationLocationReview
from games.models import Game
from tournaments.models import Tournament

from .forms import CommentForm, GamerProfileForm, PostForm, SignupForm
from .models import (
	Block,
	Comment,
	Conversation,
	ConversationParticipant,
	ExternalFeedItem,
	Follow,
	FriendRequest,
	Friendship,
	GamerProfile,
	Message,
	MessageRequest,
	Notification,
	Post,
	PostLike,
	PostSave,
	PushSubscription,
	Report,
	RespectTransaction,
	SocialIdentity,
	GamerPresence,
	Venue,
	notify,
)
from .services import can_message, refresh_public_gaming_feed
from hello_world.storage import log_s3_client_error

logger = logging.getLogger(__name__)


def _provider_redirect_base_url():
	return settings.SITE_URL.rstrip("/") if getattr(settings, "SITE_URL", "") else "http://localhost:8000"


def _build_provider_redirect_url(provider):
	base = _provider_redirect_base_url()
	if provider == "google":
		return f"{base}/accounts/auth/google/callback/"
	return f"{base}/accounts/auth/apple/callback/"


def _safe_provider_state(request, provider):
	state = secrets.token_urlsafe(32)
	request.session[f"oauth_state_{provider}"] = state
	request.session.modified = True
	return state


def _provider_error_redirect(provider, error_message):
	return redirect("login")


def _provider_is_configured(provider):
	if provider == "google":
		return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)
	if provider == "apple":
		return bool(settings.APPLE_CLIENT_ID and settings.APPLE_CLIENT_SECRET)
	return False


def _auth_provider_context():
	return {
		"google_available": _provider_is_configured("google"),
		"apple_available": _provider_is_configured("apple"),
	}


def _json_http_request(url, payload=None, headers=None, method="POST"):
	request = Request(url, data=None if payload is None else urlencode(payload).encode("utf-8"), headers=headers or {}, method=method)
	with urlopen(request, timeout=20) as response:
		content = response.read().decode("utf-8")
		return json.loads(content) if content else {}


def google_oauth_exchange(code):
	if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
		return {"error": "Google OAuth is not configured."}
	params = {
		"code": code,
		"client_id": settings.GOOGLE_CLIENT_ID,
		"client_secret": settings.GOOGLE_CLIENT_SECRET,
		"redirect_uri": settings.GOOGLE_REDIRECT_URI or _build_provider_redirect_url("google"),
		"grant_type": "authorization_code",
	}
	return _json_http_request("https://oauth2.googleapis.com/token", payload=params)


def apple_oauth_exchange(code):
	if not settings.APPLE_CLIENT_ID or not settings.APPLE_CLIENT_SECRET:
		return {"error": "Apple OAuth is not configured."}
	return _json_http_request(
		"https://appleid.apple.com/auth/token",
		payload={
			"grant_type": "authorization_code",
			"code": code,
			"redirect_uri": settings.APPLE_REDIRECT_URI or _build_provider_redirect_url("apple"),
			"client_id": settings.APPLE_CLIENT_ID,
			"client_secret": settings.APPLE_CLIENT_SECRET,
		},
	)


def _decode_jwt_claims(token):
	if not token:
		return {}
	parts = token.split(".")
	if len(parts) < 2:
		return {}
	payload = parts[1]
	padding = "=" * (-len(payload) % 4)
	try:
		decoded = json.loads(__import__("base64").urlsafe_b64decode(payload + padding).decode("utf-8"))
		return decoded if isinstance(decoded, dict) else {}
	except Exception:
		return {}


def google_oauth_userinfo(access_token):
	request = Request(
		"https://openidconnect.googleapis.com/v1/userinfo",
		headers={"Authorization": f"Bearer {access_token}"},
		method="GET",
	)
	with urlopen(request, timeout=20) as response:
		return json.loads(response.read().decode("utf-8"))


def apple_oauth_userinfo(id_token):
	if not id_token or not settings.APPLE_CLIENT_ID:
		raise ValueError("Apple identity validation is unavailable.")
	with urlopen("https://appleid.apple.com/auth/keys", timeout=20) as response:
		key_set = json.loads(response.read().decode("utf-8"))
	header = jwt.get_unverified_header(id_token)
	key_data = next((key for key in key_set.get("keys", []) if key.get("kid") == header.get("kid")), None)
	if not key_data:
		raise ValueError("Apple signing key not found.")
	public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))
	claims = jwt.decode(
		id_token,
		key=public_key,
		algorithms=["RS256"],
		audience=settings.APPLE_CLIENT_ID,
		issuer="https://appleid.apple.com",
	)
	return {
		"sub": claims.get("sub"),
		"email": claims.get("email", ""),
		"name": claims.get("email", "").split("@", 1)[0],
	}


def _resolve_or_create_provider_user(provider, claims, request):
	provider_user_id = str(claims.get("sub") or claims.get("id") or "")
	email = (claims.get("email") or "").strip()
	display_name = (claims.get("name") or claims.get("display_name") or email.split("@", 1)[0] or "GGz Player").strip()
	if not provider_user_id:
		raise ValueError("Provider identity is missing.")

	identity = SocialIdentity.objects.filter(provider=provider, provider_user_id=provider_user_id).select_related("user").first()
	if identity:
		return identity.user

	current_user = request.user if request.user.is_authenticated else None
	if current_user is not None:
		if SocialIdentity.objects.filter(provider=provider, user=current_user).exists():
			raise ValueError("This account is already linked to this provider.")
		if email:
			existing = User.objects.filter(email__iexact=email).exclude(pk=current_user.pk).first()
			if existing and not existing == current_user:
				raise ValueError("That email is already connected to a different GGz account.")
		user = current_user
	else:
		if email:
			existing = User.objects.filter(email__iexact=email).first()
			if existing:
				SocialIdentity.objects.create(user=existing, provider=provider, provider_user_id=provider_user_id, email=email, display_name=display_name)
				return existing
		base_username = re.sub(r"[^A-Za-z0-9_.-]", "", display_name)[:20] or "ggzplayer"
		base_username = base_username or "ggzplayer"
		username = base_username
		suffix = 1
		while User.objects.filter(username__iexact=username).exists():
			username = f"{base_username}{suffix}"
			suffix += 1
		if not email:
			raise ValueError("Provider identity did not include an email address.")
		user = User.objects.create_user(username=username, email=email, password=None)
		GamerProfile.objects.create(user=user, gamer_tag=(username[:20] or "GGzPlayer") + "ZW")

	SocialIdentity.objects.create(user=user, provider=provider, provider_user_id=provider_user_id, email=email, display_name=display_name)
	return user


class GGZAuthenticationForm(AuthenticationForm):
	error_messages = {
		**AuthenticationForm.error_messages,
		"invalid_login": "We couldn’t sign you in with those details. Please try again.",
		"inactive": "This account is unavailable right now.",
	}


def _safe_redirect_url(request, fallback_url="/"):
	"""Allow only internal relative redirects to reduce open redirect exposure."""
	next_url = request.POST.get("next") or request.GET.get("next") or fallback_url
	if not next_url:
		return fallback_url
	if next_url.startswith("/") and not next_url.startswith("//"):
		return next_url
	parsed = urlsplit(next_url)
	if parsed.scheme or parsed.netloc:
		return fallback_url
	return next_url


def _media_storage_error(form, exception, field_name="image"):
	if isinstance(exception, ClientError):
		log_s3_client_error(exception)
		logger.error("Media storage failed while saving %s", field_name)
	else:
		logger.exception("Media storage failed while saving %s", field_name)
	form.add_error(field_name, "The image could not be uploaded. Please try again.")


def _notify(recipient, actor, notification_type, message, target_url=""):
	notify(recipient, actor, notification_type, message, target_url)


def _is_json_request(request):
	return request.headers.get("x-requested-with") == "XMLHttpRequest" or "application/json" in request.headers.get("accept", "")


def _json_error(message, status):
	return JsonResponse({"ok": False, "error": message}, status=status)


def csrf_failure(request, reason=""):
	if _is_json_request(request):
		return _json_error("Your session or security token expired. Refresh the page and try again.", 403)
	return render(request, "403.html", status=403)


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
	query = (request.GET.get("q") or "").strip()
	category = (request.GET.get("category") or "all").strip().lower()
	verified_only = request.GET.get("verified") in {"1", "true", "True", "yes", "on"}
	distance_limit = request.GET.get("distance", "100")
	try:
		distance_limit = float(distance_limit)
	except (TypeError, ValueError):
		distance_limit = 100.0
	lat = request.GET.get("lat")
	lng = request.GET.get("lng")
	lookup_lat = None
	lookup_lng = None
	if lat not in (None, "") and lng not in (None, ""):
		try:
			lookup_lat = float(lat)
			lookup_lng = float(lng)
		except (TypeError, ValueError):
			lookup_lat = None
			lookup_lng = None

	venues = Venue.objects.filter(latitude__isnull=False, longitude__isnull=False).exclude(latitude=0, longitude=0).order_by("name")
	if query:
		venues = venues.filter(Q(name__icontains=query) | Q(category__icontains=query) | Q(city__icontains=query) | Q(province__icontains=query) | Q(country__icontains=query))
	if category and category != "all":
		venues = venues.filter(category__icontains=category.replace("-", " "))
	if lookup_lat is not None and lookup_lng is not None:
		filtered_venues = []
		for item in venues:
			distance = _distance_km(lookup_lat, lookup_lng, item.latitude, item.longitude)
			if distance is not None and distance <= distance_limit:
				filtered_venues.append((item, distance))
		venues = [item for item, _ in filtered_venues]
	venues_payload = [{
		"id": item.pk,
		"kind": "venue",
		"name": item.name,
		"latitude": float(item.latitude),
		"longitude": float(item.longitude),
		"category": item.category,
		"location": item.city or item.province or item.country or item.address or "Public location",
		"distance_km": round(distance, 1) if lookup_lat is not None and lookup_lng is not None else None,
		"url": "#",
	} for item, distance in [(item, _distance_km(lookup_lat, lookup_lng, item.latitude, item.longitude)) for item in venues] if (lookup_lat is None or lookup_lng is None or (distance is not None and distance <= distance_limit))]
	locations = OrganizationLocation.objects.filter(public_visible=True, latitude__isnull=False, longitude__isnull=False).exclude(latitude=0, longitude=0).select_related("organization").order_by("name")
	if query:
		locations = locations.filter(
			Q(name__icontains=query)
			| Q(city__icontains=query)
			| Q(country__icontains=query)
			| Q(location_type__icontains=query)
			| Q(organization__name__icontains=query)
			| Q(description__icontains=query)
			| Q(games__name__icontains=query)
		).distinct()
	if verified_only:
		locations = locations.filter(verification_status="VERIFIED")
	if category and category != "all":
		category_map = {
			"gaming hub": "Gaming Hub",
			"gaming hubs": "Gaming Hub",
			"esports": "Esports Arena",
			"esports arena": "Esports Arena",
			"lan": "LAN Centre",
			"lan centre": "LAN Centre",
			"tech": "Tech Business",
			"tech business": "Tech Business",
			"developers": "Developer Studio",
			"developer studio": "Developer Studio",
			"events": "event",
			"tournaments": "tournament",
		}
		mapped = category_map.get(category)
		if mapped == "event":
			locations = locations.none()
		elif mapped == "tournament":
			locations = locations.none()
		elif mapped:
			locations = locations.filter(location_type__icontains=mapped)
	if lookup_lat is not None and lookup_lng is not None:
		filtered_locations = []
		for item in locations:
			distance = _distance_km(lookup_lat, lookup_lng, item.latitude, item.longitude)
			if distance is not None and distance <= distance_limit:
				filtered_locations.append((item, distance))
		locations = [item for item, _ in filtered_locations]
	location_payload = []
	for item in locations:
		distance = _distance_km(lookup_lat, lookup_lng, item.latitude, item.longitude) if lookup_lat is not None and lookup_lng is not None else None
		event_count = Event.objects.filter(organization_id=item.organization_id, status__in=("Published", "Upcoming", "Live")).count()
		tournament_count = Tournament.objects.filter(venue__isnull=False, venue__name__icontains=item.name, status__in=("Registration Open", "Live", "Registration Closed")).count()
		location_payload.append({
			"id": item.pk,
			"kind": "radar_location",
			"name": item.name,
			"latitude": float(item.latitude),
			"longitude": float(item.longitude),
			"location": item.city or item.country or item.address or "Public location",
			"location_type": item.location_type,
			"verification_status": item.verification_status,
			"subscription_status": item.subscription_status,
			"ggz_score": item.ggz_score,
			"rating_average": item.average_rating,
			"rating_count": item.rating_count,
			"organization": item.organization.name,
			"organization_url": reverse("organization_public_profile", args=[item.organization.slug]),
			"description": item.description or item.organization.description,
			"event_count": event_count,
			"tournament_count": tournament_count,
			"distance_km": round(distance, 1) if distance is not None else None,
			"url": reverse("radar_location_detail", args=[item.pk]),
		})
	events = Event.objects.filter(location_public=True, latitude__isnull=False, longitude__isnull=False).exclude(latitude=0, longitude=0).select_related("game").order_by("start_date")
	if query:
		events = events.filter(Q(name__icontains=query) | Q(location__icontains=query) | Q(city__icontains=query) | Q(country__icontains=query) | Q(game__name__icontains=query))
	if category and category != "all":
		if category == "events":
			events = events.filter(location_public=True)
		elif category not in {"all"} and category not in {"gaming hubs", "esports", "lan", "tech", "developers", "tournaments"}:
			events = events.filter(Q(game__name__icontains=category) | Q(name__icontains=category))
	if verified_only:
		events = events.filter(location_public=True)
	if lookup_lat is not None and lookup_lng is not None:
		events = [event for event in events if _distance_km(lookup_lat, lookup_lng, event.latitude, event.longitude) is not None and _distance_km(lookup_lat, lookup_lng, event.latitude, event.longitude) <= distance_limit]
	event_payload = [{
		"id": item.pk,
		"kind": "event",
		"name": item.name,
		"latitude": float(item.latitude),
		"longitude": float(item.longitude),
		"location": item.location or item.city or item.country or "Public location",
		"status": item.status,
		"game": item.game.name if item.game else "General",
		"distance_km": round(_distance_km(lookup_lat, lookup_lng, item.latitude, item.longitude), 1) if lookup_lat is not None and lookup_lng is not None and _distance_km(lookup_lat, lookup_lng, item.latitude, item.longitude) is not None else None,
		"url": reverse("event_detail", args=[item.pk]),
	} for item in events]
	tournaments = Tournament.objects.filter(latitude__isnull=False, longitude__isnull=False).exclude(latitude=0, longitude=0).select_related("game").order_by("start_date")
	if query:
		tournaments = tournaments.filter(Q(name__icontains=query) | Q(location__icontains=query) | Q(city__icontains=query) | Q(country__icontains=query) | Q(game__name__icontains=query))
	if category and category != "all":
		if category == "tournaments":
			tournaments = tournaments.filter(status__in=("Registration Open", "Live", "Registration Closed"))
		elif category not in {"all", "gaming hubs", "esports", "lan", "tech", "developers", "events"}:
			tournaments = tournaments.filter(Q(game__name__icontains=category) | Q(name__icontains=category))
	if lookup_lat is not None and lookup_lng is not None:
		tournaments = [tournament for tournament in tournaments if _distance_km(lookup_lat, lookup_lng, tournament.latitude, tournament.longitude) is not None and _distance_km(lookup_lat, lookup_lng, tournament.latitude, tournament.longitude) <= distance_limit]
	tournament_payload = [{
		"id": item.pk,
		"kind": "tournament",
		"name": item.name,
		"latitude": float(item.latitude),
		"longitude": float(item.longitude),
		"location": item.location or item.city or item.country or "Public location",
		"status": item.status,
		"game": item.game.name if item.game else "General",
		"distance_km": round(_distance_km(lookup_lat, lookup_lng, item.latitude, item.longitude), 1) if lookup_lat is not None and lookup_lng is not None and _distance_km(lookup_lat, lookup_lng, item.latitude, item.longitude) is not None else None,
		"url": reverse("tournament_detail", args=[item.slug]),
	} for item in tournaments]
	organizations = Organization.objects.filter(location_public=True, latitude__isnull=False, longitude__isnull=False).exclude(latitude=0, longitude=0).order_by("name")
	if query:
		organizations = organizations.filter(Q(name__icontains=query) | Q(city__icontains=query) | Q(country__icontains=query) | Q(organization_type__icontains=query))
	if category and category != "all":
		if category in {"developers", "tech"}:
			organizations = organizations.filter(organization_type__icontains="Developer" if category == "developers" else "Tech")
	if lookup_lat is not None and lookup_lng is not None:
		filtered_organizations = []
		for item in organizations:
			distance = _distance_km(lookup_lat, lookup_lng, item.latitude, item.longitude)
			if distance is not None and distance <= distance_limit:
				filtered_organizations.append((item, distance))
		organizations = [item for item, _ in filtered_organizations]
	organization_payload = [{
		"id": item.pk,
		"kind": "organization",
		"name": item.name,
		"latitude": float(item.latitude),
		"longitude": float(item.longitude),
		"location": item.city or item.province or item.country or item.address or "Public location",
		"organization_type": item.organization_type,
		"description": item.description,
		"distance_km": round(distance, 1) if lookup_lat is not None and lookup_lng is not None else None,
		"description": item.description,
		"url": reverse("organization_public_profile", args=[item.slug]),
	} for item, distance in [(item, _distance_km(lookup_lat, lookup_lng, item.latitude, item.longitude)) for item in organizations] if (lookup_lat is None or lookup_lng is None or (distance is not None and distance <= distance_limit))]

	payload = {
		"hotspots": _map_hotspot_payload(),
		"venues": venues_payload,
		"locations": location_payload,
		"events": event_payload,
		"tournaments": tournament_payload,
		"organizations": organization_payload,
	}
	return JsonResponse(payload)


def map_page(request):
	provider = getattr(settings, "GOOGLE_MAPS_PROVIDER", getattr(settings, "GGZ_MAP_PROVIDER", "google"))
	api_key = getattr(settings, "GOOGLE_MAPS_API_KEY", getattr(settings, "GGZ_MAP_API_KEY", ""))
	default_lat = getattr(settings, "GOOGLE_MAPS_DEFAULT_LATITUDE", getattr(settings, "GGZ_MAP_DEFAULT_LATITUDE", -17.8252))
	default_lng = getattr(settings, "GOOGLE_MAPS_DEFAULT_LONGITUDE", getattr(settings, "GGZ_MAP_DEFAULT_LONGITUDE", 31.0335))
	map_id = getattr(settings, "GOOGLE_MAPS_MAP_ID", getattr(settings, "GGZ_MAP_ID", ""))
	return render(
		request,
		"accounts/map_page.html",
		{
			"map_provider": provider,
			"map_api_key": api_key,
			"map_id": map_id,
			"map_default_lat": default_lat,
			"map_default_lng": default_lng,
			"map_data_url": reverse("map_data"),
			"min_hotspot_gamers": getattr(settings, "GGZ_MAP_MIN_HOTSPOT_GAMERS", 3),
		},
	)


def radar_location_detail(request, location_id):
	location = get_object_or_404(OrganizationLocation.objects.select_related("organization").prefetch_related("games", "ratings", "reviews__author__user", "reviews__author__user__user"), pk=location_id)
	if not location.public_visible:
		return HttpResponseForbidden("This Radar location is not public.")
	upcoming_events = Event.objects.filter(organization=location.organization, status__in=("Published", "Upcoming", "Live")).select_related("game")[:5]
	upcoming_tournaments = []
	if location.organization:
		from tournaments.models import Tournament
		upcoming_tournaments = Tournament.objects.filter(venue__isnull=False, venue__name__icontains=location.name, status__in=("Registration Open", "Live", "Registration Closed")).select_related("game")[:5]
	viewer = getattr(request.user, "gamer_profile", None) if request.user.is_authenticated else None
	user_rating = None
	if viewer and request.user.is_authenticated:
		user_rating = location.ratings.filter(user=request.user).order_by("-created_at").first()
	user_review = None
	if viewer:
		user_review = location.reviews.filter(author=viewer).order_by("-created_at").first()
	return render(request, "accounts/radar_location_detail.html", {
		"location": location,
		"organization": location.organization,
		"upcoming_events": upcoming_events,
		"upcoming_tournaments": upcoming_tournaments,
		"user_rating": user_rating,
		"user_review": user_review,
		"score_breakdown": [
			("Verified venue", location.is_verified),
			("Average rating", location.average_rating is not None),
			("Active tournament host", bool(upcoming_tournaments)),
			("Active event host", bool(upcoming_events)),
			("Venue profile complete", bool(location.description or location.games.exists() or location.amenities)),
		],
	})


@login_required
def radar_location_rating_create(request, location_id):
	location = get_object_or_404(OrganizationLocation.objects.select_related("organization"), pk=location_id)
	if not location.public_visible:
		return HttpResponseForbidden("This Radar location is not public.")
	try:
		rating_value = int(request.POST.get("rating", "0"))
	except (TypeError, ValueError):
		messages.error(request, "The submitted rating was invalid.")
		return redirect("radar_location_detail", location_id=location.id)
	if rating_value not in {1, 2, 3, 4, 5}:
		messages.error(request, "The submitted rating was invalid.")
		return redirect("radar_location_detail", location_id=location.id)
	item, created = OrganizationLocationRating.objects.update_or_create(
		location=location,
		user=request.user,
		defaults={"value": rating_value},
	)
	item.value = rating_value
	item.save(update_fields=("value", "updated_at"))
	messages.success(request, "Thanks for rating this venue." if created else "Your rating was updated.")
	return redirect("radar_location_detail", location_id=location.id)


@login_required
def radar_location_review_create(request, location_id):
	location = get_object_or_404(OrganizationLocation.objects.select_related("organization"), pk=location_id)
	if not location.public_visible:
		return HttpResponseForbidden("This Radar location is not public.")
	profile = get_object_or_404(GamerProfile, user=request.user)
	review_text = (request.POST.get("review_text") or "").strip()
	if not review_text:
		messages.error(request, "Review text cannot be blank.")
		return redirect("radar_location_detail", location_id=location.id)
	try:
		rating_value = int(request.POST.get("rating", "0"))
	except (TypeError, ValueError):
		messages.error(request, "The submitted rating was invalid.")
		return redirect("radar_location_detail", location_id=location.id)
	if rating_value not in {1, 2, 3, 4, 5}:
		messages.error(request, "The submitted rating was invalid.")
		return redirect("radar_location_detail", location_id=location.id)
	review, created = OrganizationLocationReview.objects.get_or_create(
		location=location,
		author=profile,
		defaults={"rating": rating_value, "review_text": review_text},
	)
	review.rating = rating_value
	review.review_text = review_text
	review.save(update_fields=("rating", "review_text", "updated_at"))
	messages.success(request, "Review posted." if created else "Review updated.")
	return redirect("radar_location_detail", location_id=location.id)


@login_required
def radar_location_review_delete(request, location_id, review_id):
	location = get_object_or_404(OrganizationLocation, pk=location_id)
	review = get_object_or_404(OrganizationLocationReview.objects.select_related("author__user"), pk=review_id, location=location)
	if review.author.user_id != request.user.id and not request.user.is_staff:
		return HttpResponseForbidden("You cannot delete someone else’s review.")
	review.delete()
	messages.success(request, "Your review was removed.")
	return redirect("radar_location_detail", location_id=location.id)


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
		profiles = profiles.exclude(id=viewer.id).exclude(id__in=blocked_profile_ids)

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

	context = {
		"page": page_obj,
		"query": query,
		"lat": lat,
		"lng": lng,
		"radius": radius_km,
		"nearby_events": nearby_events,
		"nearby_tournaments": nearby_tournaments,
		"nearby_profiles": list(profiles[:3]) if hasattr(profiles, "__getitem__") else list(profiles)[:3],
		"nearby_profiles_total": page_obj.paginator.count,
		"nearby_activity_total": len(nearby_events) + len(nearby_tournaments),
		"nearby_venues": list(venues),
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
		"map_provider": getattr(settings, "GOOGLE_MAPS_PROVIDER", getattr(settings, "GGZ_MAP_PROVIDER", "google")),
		"map_api_key": getattr(settings, "GOOGLE_MAPS_API_KEY", getattr(settings, "GGZ_MAP_API_KEY", "")),
		"map_id": getattr(settings, "GOOGLE_MAPS_MAP_ID", getattr(settings, "GGZ_MAP_ID", "")),
		"map_default_lat": getattr(settings, "GOOGLE_MAPS_DEFAULT_LATITUDE", getattr(settings, "GGZ_MAP_DEFAULT_LATITUDE", -17.8252)),
		"map_default_lng": getattr(settings, "GOOGLE_MAPS_DEFAULT_LONGITUDE", getattr(settings, "GGZ_MAP_DEFAULT_LONGITUDE", 31.0335)),
		"map_data_url": reverse("map_data"),
		"min_hotspot_gamers": getattr(settings, "GOOGLE_MAPS_MIN_HOTSPOT_GAMERS", getattr(settings, "GGZ_MAP_MIN_HOTSPOT_GAMERS", 3)),
	}
	return render(request, "accounts/map_page.html", context)


def gamer_discovery(request):
	query = request.GET.get("q", "").strip()
	location = request.GET.get("location", "").strip()
	platform = request.GET.get("platform", "").strip()
	rank = request.GET.get("rank", "").strip()
	availability = request.GET.get("availability", "").strip()
	game_id = request.GET.get("game", "").strip()
	selected_game = Game.objects.filter(id=game_id).first() if game_id else None
	viewer = getattr(request.user, "gamer_profile", None)
	profiles = GamerProfile.objects.select_related("user").prefetch_related("games")
	if viewer:
		blocked_ids = Block.objects.filter(Q(blocker=viewer) | Q(blocked=viewer)).values_list("blocker_id", "blocked_id")
		blocked_profile_ids = {value for pair in blocked_ids for value in pair}
		profiles = profiles.exclude(id=viewer.id).exclude(id__in=blocked_profile_ids)
	criteria = any((query, location, platform, rank, availability, game_id))
	if query:
		profiles = profiles.filter(
			Q(gamer_tag__icontains=query)
			| Q(user__username__icontains=query)
			| Q(games__name__icontains=query)
			| Q(platform__icontains=query)
			| Q(rank__icontains=query)
			| Q(availability__icontains=query)
			| Q(location__icontains=query)
			| Q(city__icontains=query)
			| Q(province__icontains=query)
			| Q(country__icontains=query)
		).distinct()
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
	if query:
		profiles = profiles.annotate(
			relevance=Case(
				When(gamer_tag__iexact=query, then=Value(100)),
				When(user__username__iexact=query, then=Value(95)),
				When(games__name__iexact=query, then=Value(90)),
				When(gamer_tag__istartswith=query, then=Value(70)),
				When(user__username__istartswith=query, then=Value(65)),
				When(games__name__istartswith=query, then=Value(60)),
				When(platform__iexact=query, then=Value(55)),
				When(rank__iexact=query, then=Value(50)),
				When(availability__iexact=query, then=Value(45)),
				default=Value(10),
				output_field=IntegerField(),
			)
		).order_by("-relevance", "-respect_points", "gamer_tag")
	else:
		profiles = profiles.annotate(game_total=Count("games", distinct=True)).order_by(
			Case(When(availability="Available", then=Value(3)), default=Value(0), output_field=IntegerField()).desc(),
			"-respect_points",
			"-game_total",
			"gamer_tag",
		)
	if not criteria:
		profiles = profiles[:5]
	page = Paginator(profiles, 12).get_page(
		request.GET.get("page")
	)
	for gamer in page:
		gamer.profile_presence = _presence_snapshot(gamer, viewer)
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
			"selected_game": selected_game,
			"is_suggestion_state": not criteria,
		},
	)


def gamer_suggestions(request):
	query = request.GET.get("q", "").strip()
	if len(query) < 2:
		return JsonResponse({"results": []})
	viewer = getattr(request.user, "gamer_profile", None)
	profiles = GamerProfile.objects.select_related("user").prefetch_related("games")
	if viewer:
		blocked_ids = Block.objects.filter(Q(blocker=viewer) | Q(blocked=viewer)).values_list("blocker_id", "blocked_id")
		profiles = profiles.exclude(id=viewer.id).exclude(id__in={value for pair in blocked_ids for value in pair})
	profiles = profiles.filter(
		Q(gamer_tag__icontains=query)
		| Q(user__username__icontains=query)
		| Q(games__name__icontains=query)
	).annotate(
		relevance=Case(
			When(gamer_tag__iexact=query, then=Value(100)),
			When(user__username__iexact=query, then=Value(95)),
			When(games__name__iexact=query, then=Value(90)),
			When(gamer_tag__istartswith=query, then=Value(70)),
			When(user__username__istartswith=query, then=Value(65)),
			When(games__name__istartswith=query, then=Value(60)),
			default=Value(10),
			output_field=IntegerField(),
		)
	).distinct().order_by("-relevance", "gamer_tag")[:5]
	return JsonResponse({
		"results": [
			{
				"gamer_tag": profile.gamer_tag,
				"username": profile.user.username,
				"rank": profile.get_rank_display(),
				"url": reverse("profile_detail", args=[profile.gamer_tag]),
			}
			for profile in profiles
		]
	})


@login_required
def dashboard(request):
	profile = getattr(request.user, "gamer_profile", None)
	if profile is None:
		return redirect("signup")

	from teams.models import TeamInvitation
	from tournaments.models import Tournament

	my_tournaments = Tournament.objects.filter(organizer=profile).select_related("game").order_by("-start_date")[:3]
	my_events = Event.objects.filter(organizer=profile).select_related("game").order_by("-start_date")[:3]
	pending_team_invitations = TeamInvitation.objects.filter(invitee=profile, status="Pending").select_related("team").count()

	return render(
		request,
		"accounts/dashboard.html",
		{
			"profile": profile,
			"game_count": profile.games.count() if profile else 0,
			"gamer_count": GamerProfile.objects.exclude(user=request.user).count(),
			"my_tournaments": my_tournaments,
			"my_events": my_events,
			"pending_team_invitations": pending_team_invitations,
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


def _presence_snapshot(profile, viewer=None, refresh=False):
	presence = GamerPresence.objects.filter(profile_id=profile.id).first() if refresh else getattr(profile, "presence", None)
	if presence is None:
		return {"status": "offline", "label": "Offline", "detail": "Not active recently", "last_seen": ""}
	owner = bool(viewer and viewer.pk == profile.pk)
	status = presence.public_status(viewer_is_owner=owner)
	labels = {"online": "Online", "away": "Away", "offline": "Offline", "invisible": "Invisible"}
	detail = "Active now" if status == "online" else "Away for now" if status == "away" else "Not active recently"
	if status == "offline" and presence.show_last_seen and presence.last_seen and (owner or presence.show_online_status):
		minutes = max(0, int((timezone.now() - presence.last_seen).total_seconds() // 60))
		detail = "Last seen just now" if minutes < 1 else f"Last seen {minutes} min ago" if minutes < 60 else f"Last seen {minutes // 60}h ago"
	return {"status": status, "label": labels[status], "detail": detail, "last_seen": presence.last_seen.isoformat() if presence.last_seen and (owner or presence.show_last_seen) else ""}


def _presence_payload(profile, viewer=None, refresh=False):
	snapshot = _presence_snapshot(profile, viewer, refresh=refresh)
	return {"gamer_tag": profile.gamer_tag, **snapshot}


@login_required
def presence_heartbeat(request):
	if request.method != "POST":
		return JsonResponse({"error": "Presence heartbeat requires POST."}, status=405)
	profile = get_object_or_404(GamerProfile, user=request.user)
	requested_status = (request.POST.get("status") or "").strip().lower()
	if requested_status and requested_status not in {"online", "away", "invisible"}:
		return JsonResponse({"error": "Unsupported presence state."}, status=400)
	presence, _ = GamerPresence.objects.get_or_create(profile=profile)
	if requested_status:
		presence.manual_status = requested_status
	now = timezone.now()
	presence.last_activity = now
	presence.last_seen = now
	presence.save(update_fields=("manual_status", "last_activity", "last_seen", "updated_at"))
	return JsonResponse(_presence_payload(profile, profile))


def presence_stream(request, gamer_tag):
	profile = get_object_or_404(GamerProfile.objects.select_related("user"), gamer_tag=gamer_tag)
	viewer = getattr(request.user, "gamer_profile", None)
	if viewer and Block.objects.filter(Q(blocker=viewer, blocked=profile) | Q(blocker=profile, blocked=viewer)).exists():
		return JsonResponse({"error": "Presence unavailable."}, status=404)
	def events():
		last_payload = None
		for _ in range(8):
			payload = _presence_payload(profile, viewer, refresh=True)
			if payload != last_payload:
				yield f"data: {json.dumps(payload)}\n\n"
				last_payload = payload
			else:
				yield ": heartbeat\n\n"
			time.sleep(1)
	return StreamingHttpResponse(events(), content_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


def profile_detail(request, gamer_tag):
	profile = get_object_or_404(
		GamerProfile.objects.select_related("user", "presence").prefetch_related("games", "posts__game"),
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
			"presence": _presence_snapshot(profile, viewer),
			"presence_stream_url": reverse("presence_stream", args=[profile.gamer_tag]),
			"presence_heartbeat_url": reverse("presence_heartbeat"),
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


def connection_action(request, gamer_tag, action):
	if not request.user.is_authenticated:
		if _is_json_request(request):
			return _json_error("Sign in to follow players.", 401)
		return redirect(f"{settings.LOGIN_URL}?next={request.path}")
	if request.method != "POST":
		return _json_error("This action requires POST.", 405) if _is_json_request(request) else HttpResponseForbidden("This action requires POST.")
	target = GamerProfile.objects.filter(gamer_tag=gamer_tag).first()
	viewer = GamerProfile.objects.filter(user=request.user).first()
	if target is None:
		return _json_error("That player could not be found.", 404) if _is_json_request(request) else HttpResponseForbidden("That player could not be found.")
	if viewer is None:
		return _json_error("Your player profile is unavailable.", 403) if _is_json_request(request) else HttpResponseForbidden("Your player profile is unavailable.")
	if target == viewer:
		return _json_error("You cannot interact with your own profile.", 403) if _is_json_request(request) else HttpResponseForbidden("You cannot interact with your own profile.")
	if action == "follow":
		if Block.objects.filter(Q(blocker=target, blocked=viewer) | Q(blocker=viewer, blocked=target)).exists():
			return _json_error("Blocked players cannot follow each other.", 403) if _is_json_request(request) else HttpResponseForbidden("Blocked players cannot follow each other.")
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
		return _json_error("Unknown connection action.", 400) if _is_json_request(request) else HttpResponseForbidden("Unknown connection action.")
	messages.success(request, "Your community action was updated.")
	if _is_json_request(request):
			return JsonResponse({
				"ok": True,
				"action": action,
				"following": Follow.objects.filter(follower=viewer, following=target).exists(),
				"follower_count": target.followers.count(),
			})
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


def _ensure_external_feed_items_for_game(game):
	if not game:
		return []
	seed_items = [
		{
			"source_name": "Official Community",
			"title": f"{game.name} community update",
			"excerpt": f"Fresh public updates, creator highlights, and match-day notes for {game.name}.",
			"url": f"https://www.example.com/{game.name.lower().replace(' ', '-')}-community-update",
			"source_url": "https://www.example.com/",
			"content_type": "UPDATE",
		},
		{
			"source_name": "GGz Gaming Desk",
			"title": f"{game.name} seasonal spotlight",
			"excerpt": f"A quick look at the latest competitive rhythm, rewards, and player buzz around {game.name}.",
			"url": f"https://www.example.com/{game.name.lower().replace(' ', '-')}-spotlight",
			"source_url": "https://www.example.com/",
			"content_type": "NEWS",
		},
	]
	created = []
	for index, payload in enumerate(seed_items):
		item, is_new = ExternalFeedItem.objects.get_or_create(
			external_id=f"{game.pk}-{index}-{payload['title']}",
			defaults={
				"game": game,
				"source_name": payload["source_name"],
				"source_url": payload["source_url"],
				"title": payload["title"],
				"excerpt": payload["excerpt"],
				"url": payload["url"],
				"image_url": "",
				"video_url": "",
				"published_at": timezone.now(),
				"content_type": payload["content_type"],
				"is_active": True,
			},
		)
		if is_new:
			created.append(item)
	return created or list(ExternalFeedItem.objects.filter(game=game).order_by("-published_at")[:2])


def _for_you_discovery_items(viewer, limit=5):
	if not viewer:
		return []
	interest_game_ids = list(viewer.games.values_list("id", flat=True))
	if not interest_game_ids:
		return list(ExternalFeedItem.objects.select_related("game").filter(is_active=True).order_by("-published_at")[:limit])
	items = ExternalFeedItem.objects.filter(Q(game_id__in=interest_game_ids) | Q(game__players=viewer), is_active=True).select_related("game").distinct()
	if not items.exists():
		for game in Game.objects.filter(id__in=interest_game_ids):
			_ensure_external_feed_items_for_game(game)
		items = ExternalFeedItem.objects.filter(Q(game_id__in=interest_game_ids) | Q(game__players=viewer), is_active=True).select_related("game").distinct()
	return list(items.order_by("-published_at")[:limit])


def feed(request):
	viewer = getattr(request.user, "gamer_profile", None)
	posts = _visible_posts(viewer)
	tab = request.GET.get("tab", "for-you" if viewer else "latest")
	game_id = request.GET.get("game")
	if game_id:
		posts = posts.filter(game_id=game_id)
	if tab == "following" and viewer:
		followed_profile_ids = viewer.following.values_list("following_id", flat=True)
		posts = posts.filter(author_id__in=followed_profile_ids)
	elif tab == "for-you" and viewer:
		interest_game_ids = viewer.games.values_list("id", flat=True)
		if interest_game_ids:
			posts = posts.filter(Q(game_id__in=interest_game_ids) | Q(author__games__in=interest_game_ids)).distinct()
		else:
			posts = posts.order_by("-created_at")
	elif tab == "latest":
		posts = posts.order_by("-created_at")
	posts = posts.order_by("-created_at")
	page = Paginator(posts, 10).get_page(request.GET.get("page"))
	liked_post_ids = set(PostLike.objects.filter(user=viewer, post__in=page.object_list).values_list("post_id", flat=True)) if viewer else set()
	saved_post_ids = set(PostSave.objects.filter(user=viewer, post__in=page.object_list).values_list("post_id", flat=True)) if viewer else set()
	if tab == "for-you":
		discovery_items = _for_you_discovery_items(viewer, limit=5) if viewer else list(ExternalFeedItem.objects.filter(is_active=True).select_related("game").order_by("-published_at")[:5])
	else:
		discovery_items = []
	trending_games = Game.objects.order_by("-popularity", "name")[:5]
	game_choices = Game.objects.order_by("-popularity", "name")[:10]
	trending_players = GamerProfile.objects.select_related("user").order_by("-respect_points", "gamer_tag")[:5]
	upcoming_tournaments = Tournament.objects.filter(status__in=("Registration Open", "Registration Closed", "Live")).select_related("organizer", "game").order_by("start_date")[:5]
	upcoming_events = Event.objects.filter(status__in=("Upcoming", "Published", "Live")).select_related("organizer", "game").order_by("start_date")[:5]
	return render(
		request,
		"accounts/feed.html",
		{
			"page": page,
			"tab": tab,
			"game_id": game_id,
			"post_form": PostForm(),
			"game_choices": game_choices,
			"liked_post_ids": liked_post_ids,
			"saved_post_ids": saved_post_ids,
			"discovery_items": discovery_items,
			"trending_games": trending_games,
			"trending_players": trending_players,
			"upcoming_tournaments": upcoming_tournaments,
			"upcoming_events": upcoming_events,
		},
	)


@login_required
def feed_refresh(request):
	viewer = getattr(request.user, "gamer_profile", None)
	if request.method != "POST":
		return redirect("feed")
	game_id = request.POST.get("game")
	if game_id:
		game = get_object_or_404(Game, id=game_id)
		refresh_public_gaming_feed(game_ids=[game.id])
	elif viewer:
		refresh_public_gaming_feed(game_ids=list(viewer.games.values_list("id", flat=True)))
	else:
		refresh_public_gaming_feed()
	messages.success(request, "Your GGz gaming discovery feed refreshed.")
	return redirect(f"{reverse('feed')}?tab=for-you")


@login_required
def post_create(request):
	if request.method != "POST":
		return redirect("feed")
	form = PostForm(request.POST, request.FILES)
	if form.is_valid():
		post = form.save(commit=False)
		post.author = get_object_or_404(GamerProfile, user=request.user)
		try:
			post.save()
		except (BotoCoreError, ClientError, OSError) as exception:
			_media_storage_error(form, exception)
			if request.headers.get("x-requested-with") == "XMLHttpRequest":
				return JsonResponse({"ok": False, "error": "The image could not be uploaded. Please try again."})
			return render(request, "accounts/feed.html", {"post_form": form})
		_notify(post.author, get_object_or_404(GamerProfile, user=request.user), "post", f"{post.author.gamer_tag} published a post", f"/feed/posts/{post.id}/")
		messages.success(request, "Your post is live in the community feed.")
		if request.headers.get("x-requested-with") == "XMLHttpRequest":
			post_html = render_to_string(
				"accounts/post_card.html",
				{"post": post, "request": request, "liked_post_ids": set(), "saved_post_ids": set()},
				request=request,
			)
			return JsonResponse({"ok": True, "message": "Your post is live in the community feed.", "post_html": post_html})
		return redirect("feed")
	if request.headers.get("x-requested-with") == "XMLHttpRequest":
		return JsonResponse({"ok": False, "error": form.errors.as_json()})
	return render(request, "accounts/feed.html", {"post_form": form})


@login_required
def post_edit(request, post_id):
	post = get_object_or_404(Post, id=post_id, author__user=request.user)
	form = PostForm(request.POST or None, request.FILES or None, instance=post)
	if form.is_valid():
		try:
			form.save()
		except (BotoCoreError, ClientError, OSError) as exception:
			_media_storage_error(form, exception)
			return render(request, "accounts/post_edit.html", {"form": form, "post": post})
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
				if request.headers.get("x-requested-with") == "XMLHttpRequest":
					return JsonResponse({"ok": False, "error": "You cannot comment on this post right now."})
				return redirect("post_detail", post_id=post.id)
			comment.save()
			if comment.post.author != comment.author:
				_notify(comment.post.author, comment.author, "comment", f"{comment.author.gamer_tag} commented on your post", f"/feed/posts/{comment.post.id}/")
			if request.headers.get("x-requested-with") == "XMLHttpRequest":
				comment_html = render_to_string("accounts/comment_item.html", {"comment": comment, "request": request}, request=request)
				return JsonResponse({"ok": True, "comment_html": comment_html, "comment_count": post.comments.count()})
			return redirect("post_detail", post_id=post.id)
		if request.headers.get("x-requested-with") == "XMLHttpRequest":
			return JsonResponse({"ok": False, "error": form.errors.as_json()})
	viewer = getattr(request.user, "gamer_profile", None)
	liked_post_ids = {post.id} if viewer and PostLike.objects.filter(post=post, user=viewer).exists() else set()
	saved_post_ids = {post.id} if viewer and PostSave.objects.filter(post=post, user=viewer).exists() else set()
	return render(request, "accounts/post_detail.html", {"post": post, "comment_form": form, "liked_post_ids": liked_post_ids, "saved_post_ids": saved_post_ids})


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
		return JsonResponse({"ok": True, "liked": created, "count": PostLike.objects.filter(post=post).count()})
	return redirect(request.POST.get("next") or "feed")


@login_required
def post_save_toggle(request, post_id):
	post = get_object_or_404(_visible_posts(getattr(request.user, "gamer_profile", None)), id=post_id)
	profile = get_object_or_404(GamerProfile, user=request.user)
	save_item = PostSave.objects.filter(post=post, user=profile).first()
	if save_item:
		save_item.delete()
		liked = False
	else:
		PostSave.objects.create(post=post, user=profile)
		liked = True
	if request.headers.get("x-requested-with") == "XMLHttpRequest":
		return JsonResponse({"ok": True, "saved": liked, "count": post.saved_by.count()})
	return redirect(request.POST.get("next") or "feed")


@login_required
def post_download(request, post_id):
	post = get_object_or_404(_visible_posts(getattr(request.user, "gamer_profile", None)), id=post_id)
	if not post.image:
		if request.headers.get("x-requested-with") == "XMLHttpRequest":
			return JsonResponse({"ok": False, "error": "This post has no downloadable media."}, status=404)
		return redirect("post_detail", post_id=post.id)
	try:
		return FileResponse(post.image.open("rb"), as_attachment=True, filename=post.image.name.rsplit("/", 1)[-1])
	except (FileNotFoundError, OSError):
		if request.headers.get("x-requested-with") == "XMLHttpRequest":
			return JsonResponse({"ok": False, "error": "That media is temporarily unavailable."}, status=404)
		return redirect("post_detail", post_id=post.id)


@login_required
def post_report(request, post_id):
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	post = get_object_or_404(_visible_posts(getattr(request.user, "gamer_profile", None)), id=post_id)
	reporter = get_object_or_404(GamerProfile, user=request.user)
	Report.objects.get_or_create(reporter=reporter, post=post)
	return redirect("post_detail", post_id=post.id)


def _unread_message_count(profile):
	participant = ConversationParticipant.objects.filter(conversation_id=OuterRef("conversation_id"), profile=profile)
	return Message.objects.filter(conversation__participants=profile).exclude(sender=profile).filter(
		Exists(participant.filter(Q(cleared_at__isnull=True) | Q(cleared_at__lt=OuterRef("created_at"))))
	).filter(
		Exists(participant.filter(Q(last_read_at__isnull=True) | Q(last_read_at__lt=OuterRef("created_at"))))
	).count()


@login_required
def notification_list(request):
	profile = get_object_or_404(GamerProfile, user=request.user)
	profile.notifications.filter(seen_at__isnull=True).update(seen_at=timezone.now())
	notifications = profile.notifications.all()
	pending_message_request_count = MessageRequest.objects.filter(recipient=profile, status="Pending").count()
	return render(
		request,
		"accounts/notification_list.html",
		{
			"notifications": notifications,
			"unread_count": notifications.filter(is_read=False).count(),
			"pending_message_request_count": pending_message_request_count,
			"unread_notification_count": notifications.filter(is_read=False).count(),
			"unread_message_count": _unread_message_count(profile),
		},
	)


@login_required
def notification_read(request, notification_id):
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	profile = get_object_or_404(GamerProfile, user=request.user)
	notification = get_object_or_404(Notification, id=notification_id, recipient=profile)
	notification.is_read = True
	notification.seen_at = notification.seen_at or timezone.now()
	notification.save(update_fields=("is_read", "seen_at"))
	if request.headers.get("x-requested-with") == "XMLHttpRequest":
		return JsonResponse({"ok": True, "unread_count": profile.notifications.filter(is_read=False).count(), "target_url": notification.target_url})
	return redirect(notification.target_url or "notification_list")


@login_required
def notification_unread(request, notification_id):
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	profile = get_object_or_404(GamerProfile, user=request.user)
	Notification.objects.filter(id=notification_id, recipient=profile).update(is_read=False)
	if request.headers.get("x-requested-with") == "XMLHttpRequest":
		return JsonResponse({"ok": True, "unread_count": profile.notifications.filter(is_read=False).count()})
	return redirect("notification_list")


@login_required
def notifications_read_all(request):
	if request.method == "POST":
		Notification.objects.filter(recipient__user=request.user, is_read=False).update(is_read=True)
		if request.headers.get("x-requested-with") == "XMLHttpRequest":
			return JsonResponse({"ok": True, "unread_count": 0})
	return redirect("notification_list")


@login_required
def push_subscription(request):
	if request.method not in {"POST", "DELETE"}:
		return JsonResponse({"ok": False, "error": "Push subscriptions require POST or DELETE."}, status=405)
	if request.method == "DELETE":
		try:
			payload = json.loads(request.body or "{}")
		except (TypeError, ValueError):
			payload = {}
		endpoint = str(payload.get("endpoint") or "").strip()
		if endpoint:
			PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
		return JsonResponse({"ok": True, "subscribed": False})
	try:
		payload = json.loads(request.body or "{}")
	except (TypeError, ValueError):
		return JsonResponse({"ok": False, "error": "Invalid subscription payload."}, status=400)
	endpoint = str(payload.get("endpoint") or "").strip()
	keys = payload.get("keys") or {}
	p256dh = str(keys.get("p256dh") or "").strip()
	auth = str(keys.get("auth") or "").strip()
	if not endpoint.startswith("https://") or not p256dh or not auth:
		return JsonResponse({"ok": False, "error": "A valid browser subscription is required."}, status=400)
	if len(endpoint) > 500 or len(p256dh) > 255 or len(auth) > 255:
		return JsonResponse({"ok": False, "error": "The browser subscription is too large."}, status=400)
	PushSubscription.objects.update_or_create(
		endpoint=endpoint,
		defaults={"user": request.user, "p256dh": p256dh, "auth": auth},
	)
	return JsonResponse({"ok": True, "subscribed": True})


@login_required
def notification_stream(request):
	profile = get_object_or_404(GamerProfile, user=request.user)
	latest = profile.notifications.select_related("actor").first()
	payload = {
		"unread_count": profile.notifications.filter(is_read=False).count(),
		"unread_message_count": _unread_message_count(profile),
		"latest_id": latest.id if latest else None,
		"latest_message": latest.message if latest else "",
		"latest_target": latest.target_url if latest else "",
	}
	if request.GET.get("format") == "json":
		return JsonResponse(payload)
	def events():
		last_signature = None
		for _ in range(60):
			latest = profile.notifications.select_related("actor").first()
			payload = {
				"unread_count": profile.notifications.filter(is_read=False).count(),
				"unread_message_count": _unread_message_count(profile),
				"latest_id": latest.id if latest else None,
				"latest_message": latest.message if latest else "",
				"latest_target": latest.target_url if latest else "",
			}
			signature = json.dumps(payload, sort_keys=True)
			if signature != last_signature:
				last_signature = signature
				yield f"data: {signature}\n\n"
			else:
				yield ": heartbeat\n\n"
			time.sleep(1)
	return StreamingHttpResponse(events(), content_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@login_required
def conversation_list(request):
	profile = get_object_or_404(GamerProfile, user=request.user)
	conversations = Conversation.objects.filter(participants=profile).prefetch_related("participants", "messages", "participant_links")
	for conversation in conversations:
		conversation.other = conversation.participants.exclude(id=profile.id).first()
		conversation.other_presence = _presence_snapshot(conversation.other, profile) if conversation.other else {"status": "offline", "label": "Offline", "detail": ""}
		participant = conversation.participant_links.get(profile=profile)
		visible_messages = conversation.messages.filter(created_at__gt=participant.cleared_at) if participant.cleared_at else conversation.messages.all()
		conversation.last_message = visible_messages.last()
		unread_messages = visible_messages.exclude(sender=profile)
		conversation.unread_count = unread_messages.filter(created_at__gt=participant.last_read_at).count() if participant.last_read_at else unread_messages.count()
	return render(request, "accounts/conversation_list.html", {"conversations": conversations, "profile": profile, "unread_message_count": _unread_message_count(profile), "pending_message_request_count": MessageRequest.objects.filter(recipient=profile, status="Pending").count(), "inbox_stream_url": reverse("conversation_inbox_stream")})


def _conversation_snapshot(profile):
	items = []
	for conversation in Conversation.objects.filter(participants=profile).prefetch_related("participants", "messages", "participant_links"):
		other = conversation.participants.exclude(id=profile.id).first()
		if not other:
			continue
		participant = conversation.participant_links.get(profile=profile)
		visible = conversation.messages.filter(created_at__gt=participant.cleared_at) if participant.cleared_at else conversation.messages.all()
		last_message = visible.last()
		unread = visible.exclude(sender=profile).filter(created_at__gt=participant.last_read_at).count() if participant.last_read_at else visible.exclude(sender=profile).count()
		items.append({"id": conversation.id, "preview": last_message.body[:120] if last_message else "No messages yet", "time": timezone.localtime(last_message.created_at).strftime("%H:%M") if last_message else "", "unread_count": unread})
	return {"items": items, "unread_message_count": _unread_message_count(profile)}


@login_required
def conversation_inbox_stream(request):
	profile = get_object_or_404(GamerProfile, user=request.user)
	if request.GET.get("format") == "json":
		return JsonResponse(_conversation_snapshot(profile))
	def events():
		last_payload = None
		for _ in range(60):
			payload = _conversation_snapshot(profile)
			encoded = json.dumps(payload, sort_keys=True)
			if encoded != last_payload:
				last_payload = encoded
				yield f"data: {encoded}\n\n"
			else:
				yield ": heartbeat\n\n"
			time.sleep(1)
	return StreamingHttpResponse(events(), content_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@login_required
def message_requests(request):
	profile = get_object_or_404(GamerProfile, user=request.user)
	incoming = MessageRequest.objects.filter(recipient=profile).select_related("sender__user", "recipient__user").order_by("-created_at")
	outgoing = MessageRequest.objects.filter(sender=profile).select_related("recipient__user").order_by("-created_at")
	pending_message_request_count = incoming.filter(status="Pending").count()
	return render(
		request,
		"accounts/message_requests.html",
		{
			"profile": profile,
			"incoming": incoming,
			"outgoing": outgoing,
			"pending_message_request_count": pending_message_request_count,
			"unread_message_count": _unread_message_count(profile),
			"unread_notification_count": profile.notifications.filter(is_read=False).count(),
		},
	)


@login_required
def conversation_detail(request, conversation_id):
	profile = get_object_or_404(GamerProfile, user=request.user)
	conversation = get_object_or_404(Conversation.objects.prefetch_related("participants"), id=conversation_id, participants=profile)
	participant = get_object_or_404(ConversationParticipant, conversation=conversation, profile=profile)
	other = conversation.participants.exclude(id=profile.id).first()
	if other and Block.objects.filter(Q(blocker=profile, blocked=other) | Q(blocker=other, blocked=profile)).exists():
		return HttpResponseForbidden("You cannot access this conversation.")
	if request.method == "POST":
		if request.POST.get("action") == "read":
			now = timezone.now()
			participant.last_read_at = now
			participant.save(update_fields=("last_read_at",))
			conversation.messages.filter(sender=other, read_at__isnull=True).update(delivered_at=now, read_at=now)
			if request.headers.get("x-requested-with") == "XMLHttpRequest":
				return JsonResponse({"ok": True, "unread_message_count": _unread_message_count(profile)})
			return redirect("conversation_detail", conversation_id=conversation.id)
		if request.POST.get("action") == "clear":
			participant.cleared_at = timezone.now()
			participant.last_read_at = participant.cleared_at
			participant.save(update_fields=("cleared_at", "last_read_at"))
			messages.success(request, "Conversation cleared for you.")
			return redirect("conversation_detail", conversation_id=conversation.id)
		body = request.POST.get("body", "").strip()
		client_id = (request.POST.get("client_id") or "").strip()[:64] or None
		other = conversation.participants.exclude(id=profile.id).first()
		if body and other and can_message(profile, other):
			message = Message.objects.filter(conversation=conversation, sender=profile, client_id=client_id).first() if client_id else None
			created = message is None
			if message is None:
				message = Message.objects.create(conversation=conversation, sender=profile, body=body, client_id=client_id)
			conversation.save(update_fields=("updated_at",))
			if created:
				_notify(other, profile, "message", f"{profile.gamer_tag} sent you a message", f"/messages/{conversation.id}/")
			if request.headers.get("x-requested-with") == "XMLHttpRequest":
				return JsonResponse({"ok": True, "message": _message_payload(message, profile)})
		return redirect("conversation_detail", conversation_id=conversation.id)
	ConversationParticipant.objects.filter(conversation=conversation, profile=profile).update(last_read_at=timezone.now())
	conversation.messages.filter(sender=other, read_at__isnull=True).update(delivered_at=timezone.now(), read_at=timezone.now())
	messages_qs = conversation.messages.filter(created_at__gt=participant.cleared_at) if participant.cleared_at else conversation.messages.all()
	messages_qs = list(messages_qs.select_related("sender").order_by("-id")[:50])
	messages_qs.reverse()
	return render(request, "accounts/conversation_detail.html", {"conversation": conversation, "profile": profile, "other": other, "other_presence": _presence_snapshot(other, profile) if other else {"status": "offline", "label": "Offline", "detail": ""}, "conversation_messages": messages_qs, "conversation_stream_url": reverse("conversation_stream", args=[conversation.id]), "conversation_send_url": reverse("conversation_send", args=[conversation.id])})


def _message_payload(message, viewer):
	return {
		"id": message.id,
		"body": message.body,
		"client_id": message.client_id or "",
		"time": timezone.localtime(message.created_at).strftime("%H:%M"),
		"mine": message.sender_id == viewer.id,
		"state": "read" if message.read_at else "delivered" if message.delivered_at else "sent",
		"created_at": message.created_at.isoformat(),
	}


@login_required
def conversation_send(request, conversation_id):
	if request.method != "POST":
		return JsonResponse({"error": "Messages require POST."}, status=405)
	profile = get_object_or_404(GamerProfile, user=request.user)
	conversation = get_object_or_404(Conversation, id=conversation_id, participants=profile)
	participant = get_object_or_404(ConversationParticipant, conversation=conversation, profile=profile)
	other = conversation.participants.exclude(id=profile.id).first()
	if not other or Block.objects.filter(Q(blocker=profile, blocked=other) | Q(blocker=other, blocked=profile)).exists():
		return JsonResponse({"error": "You cannot message this player."}, status=403)
	body = request.POST.get("body", "").strip()
	client_id = (request.POST.get("client_id") or "").strip()[:64] or None
	if not body or len(body) > 2000 or not can_message(profile, other):
		return JsonResponse({"error": "That message could not be sent."}, status=400)
	message = Message.objects.filter(conversation=conversation, sender=profile, client_id=client_id).first() if client_id else None
	created = message is None
	if message is None:
		message = Message.objects.create(conversation=conversation, sender=profile, body=body, client_id=client_id)
	conversation.save(update_fields=("updated_at",))
	if created:
		_notify(other, profile, "message", f"{profile.gamer_tag} sent you a message", f"/messages/{conversation.id}/")
	return JsonResponse({"ok": True, "message": _message_payload(message, profile), "unread_message_count": _unread_message_count(profile)})


@login_required
def conversation_typing(request, conversation_id):
	if request.method != "POST":
		return JsonResponse({"error": "Typing state requires POST."}, status=405)
	profile = get_object_or_404(GamerProfile, user=request.user)
	conversation = get_object_or_404(Conversation, id=conversation_id, participants=profile)
	participant = get_object_or_404(ConversationParticipant, conversation=conversation, profile=profile)
	if request.POST.get("typing") == "true":
		participant.typing_until = timezone.now() + timedelta(seconds=4)
	else:
		participant.typing_until = None
	participant.save(update_fields=("typing_until",))
	return JsonResponse({"ok": True})


@login_required
def conversation_stream(request, conversation_id):
	profile = get_object_or_404(GamerProfile, user=request.user)
	conversation = get_object_or_404(Conversation, id=conversation_id, participants=profile)
	other = conversation.participants.exclude(id=profile.id).first()
	if not other or Block.objects.filter(Q(blocker=profile, blocked=other) | Q(blocker=other, blocked=profile)).exists():
		return JsonResponse({"error": "Conversation unavailable."}, status=404)
	if request.GET.get("format") == "json":
		try:
			after_id = max(0, int(request.GET.get("after", 0) or 0))
			before_id = max(0, int(request.GET.get("before", 0) or 0))
		except (TypeError, ValueError):
			return JsonResponse({"error": "Invalid message cursor."}, status=400)
		messages_query = conversation.messages.select_related("sender")
		if before_id:
			messages_query = messages_query.filter(id__lt=before_id).order_by("-id")[:50]
		else:
			messages_query = messages_query.filter(id__gt=after_id).order_by("id")[:50]
		messages = list(messages_query)
		if before_id:
			messages.reverse()
		payloads = []
		for message in messages:
			if message.sender_id != profile.id and message.delivered_at is None:
				message.delivered_at = timezone.now()
				message.save(update_fields=("delivered_at",))
			payloads.append(_message_payload(message, profile))
		return JsonResponse({"messages": payloads, "has_more": len(messages) == 50, "unread_message_count": _unread_message_count(profile)})
	def events():
		last_payloads = {}
		last_typing = None
		for _ in range(60):
			messages_qs = conversation.messages.select_related("sender").order_by("id")
			for message in messages_qs:
				if message.sender_id != profile.id and message.delivered_at is None:
					message.delivered_at = timezone.now()
					message.save(update_fields=("delivered_at",))
				payload = _message_payload(message, profile)
				if last_payloads.get(message.id) != payload:
					last_payloads[message.id] = payload
					yield f"data: {json.dumps(payload)}\n\n"
			if not messages_qs:
				yield ": heartbeat\n\n"
			typing_link = ConversationParticipant.objects.filter(conversation=conversation, profile=other).first()
			typing = bool(typing_link and typing_link.typing_until and typing_link.typing_until > timezone.now())
			if typing != last_typing:
				last_typing = typing
				yield f"data: {json.dumps({'event': 'typing', 'typing': typing})}\n\n"
			time.sleep(1)
	return StreamingHttpResponse(events(), content_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@login_required
def conversation_start(request, gamer_tag):
	profile = get_object_or_404(GamerProfile, user=request.user)
	other = get_object_or_404(GamerProfile, gamer_tag=gamer_tag)
	if request.method not in {"GET", "POST"}:
		return HttpResponseForbidden("Invalid conversation action.")
	if Block.objects.filter(Q(blocker=profile, blocked=other) | Q(blocker=other, blocked=profile)).exists():
		return HttpResponseForbidden("You cannot contact this player.")
	context_url = (request.POST.get("context_url") or request.GET.get("context_url") or "").strip()
	context_label = (request.POST.get("context_label") or request.GET.get("context_label") or "").strip()[:160]
	if not context_url.startswith("/") or context_url.startswith("//"):
		context_url = ""
	if not can_message(profile, other):
		if request.method == "POST":
			request_row, created = MessageRequest.objects.get_or_create(sender=profile, recipient=other, defaults={"status": "Pending", "context_url": context_url, "context_label": context_label})
			if not created and request_row.status != "Accepted":
				request_row.status = "Pending"
				request_row.context_url = context_url or request_row.context_url
				request_row.context_label = context_label or request_row.context_label
				request_row.save(update_fields=("status", "context_url", "context_label"))
			_notify(other, profile, "message_request", f"{profile.gamer_tag} sent you a message request", f"/profiles/{profile.gamer_tag}/")
			if request.headers.get("x-requested-with") == "XMLHttpRequest":
				return JsonResponse({"ok": True, "requested": True, "message": "Message request sent."})
			return redirect("message_requests")
		return HttpResponseForbidden("You need permission or an accepted message request to contact this gamer.")
	conversation = Conversation.objects.filter(participants=profile).filter(participants=other).first()
	if not conversation:
		conversation = Conversation.objects.create()
		ConversationParticipant.objects.bulk_create([ConversationParticipant(conversation=conversation, profile=profile), ConversationParticipant(conversation=conversation, profile=other)])
	if request.headers.get("x-requested-with") == "XMLHttpRequest":
		return JsonResponse({"ok": True, "conversation_id": conversation.id, "url": reverse("conversation_detail", args=[conversation.id])})
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
		if request.headers.get("x-requested-with") == "XMLHttpRequest":
			return JsonResponse({"ok": True, "message": "Message request cancelled.", "status": "Deleted"})
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
			if request.headers.get("x-requested-with") == "XMLHttpRequest":
				return JsonResponse({"ok": True, "message": "Message request removed.", "status": "Deleted"})
			return redirect("profile_detail", gamer_tag=other.gamer_tag)
		request_row.save(update_fields=("status",))
	if request.headers.get("x-requested-with") == "XMLHttpRequest":
		return JsonResponse({"ok": True, "message": f"Message request {request_row.status.lower()}.", "status": request_row.status})
	return redirect("profile_detail", gamer_tag=other.gamer_tag)


@login_required
def profile_game_add(request, gamer_tag):
	profile = get_object_or_404(GamerProfile.objects.select_related("user"), gamer_tag=gamer_tag)
	if request.user != profile.user:
		return HttpResponseForbidden("You can only manage your own game list.")
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	game_id = request.POST.get("game_id")
	if not game_id:
		messages.error(request, "Choose a game to add.")
		return redirect("profile_detail", gamer_tag=profile.gamer_tag)
	game = get_object_or_404(Game, id=game_id)
	profile.games.add(game)
	messages.success(request, f"Added {game.name} to your profile.")
	next_url = request.POST.get("next")
	if next_url and next_url.startswith("/games/"):
		return redirect(next_url)
	return redirect("profile_detail", gamer_tag=profile.gamer_tag)


@login_required
def profile_game_remove(request, gamer_tag, game_id):
	profile = get_object_or_404(GamerProfile.objects.select_related("user"), gamer_tag=gamer_tag)
	if request.user != profile.user:
		return HttpResponseForbidden("You can only manage your own game list.")
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	game = get_object_or_404(Game, id=game_id)
	profile.games.remove(game)
	messages.success(request, f"Removed {game.name} from your profile.")
	return redirect("profile_detail", gamer_tag=profile.gamer_tag)


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
		try:
			updated_profile = form.save()
		except (BotoCoreError, ClientError, OSError) as exception:
			_media_storage_error(form, exception, "cover" if request.FILES.get("cover") and not request.FILES.get("avatar") else "avatar")
			return render(request, "accounts/profile_edit.html", {"form": form, "profile": profile})
		return redirect("profile_detail", gamer_tag=updated_profile.gamer_tag)

	return render(
		request,
		"accounts/profile_edit.html",
		{"form": form, "profile": profile},
	)


def signup(request):
	form = SignupForm(request.POST or None)
	if request.method == "POST" and form.is_valid():
		user = form.save()
		login(request, user)
		messages.success(request, "Welcome to GGz. Your account is ready.")
		next_url = request.POST.get("next")
		if next_url and _safe_redirect_url(request, reverse("profile_detail", args=[user.gamer_profile.gamer_tag])) == reverse("profile_detail", args=[user.gamer_profile.gamer_tag]):
			next_url = reverse("profile_detail", args=[user.gamer_profile.gamer_tag])
		return redirect(next_url or reverse("profile_detail", args=[user.gamer_profile.gamer_tag]))
	return render(request, "accounts/signup.html", {"form": form, "next": _safe_redirect_url(request, "/"), **_auth_provider_context()})


def ggz_login(request):
	form = GGZAuthenticationForm(request, data=request.POST or None)
	if request.method == "POST":
		if form.is_valid():
			user = form.get_user()
			login(request, user)
			request.session.cycle_key()
			messages.success(request, "You’re signed in.")
			return redirect(_safe_redirect_url(request, "/"))
		messages.error(request, "We couldn’t sign you in with those details. Please try again.")
	return render(request, "registration/login.html", {"form": form, "next": _safe_redirect_url(request, "/"), **_auth_provider_context()})


def ggz_logout(request):
	if request.method == "POST":
		logout(request)
		messages.success(request, "You have been signed out.")
	return redirect("login")


def google_login_start(request):
	request.session["oauth_next"] = _safe_redirect_url(request, "/")
	if not _provider_is_configured("google"):
		messages.error(request, "Google sign-in is not available right now. Please use your GGz password.")
		return redirect("login")
	redirect_uri = settings.GOOGLE_REDIRECT_URI or _build_provider_redirect_url("google")
	state = _safe_provider_state(request, "google")
	params = {
		"client_id": settings.GOOGLE_CLIENT_ID,
		"redirect_uri": redirect_uri,
		"response_type": "code",
		"scope": "openid email profile",
		"state": state,
		"access_type": "online",
		"prompt": "select_account",
	}
	return redirect(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}")


def google_login_callback(request):
	state = request.GET.get("state")
	if state != request.session.get("oauth_state_google"):
		messages.error(request, "Google sign-in was interrupted; please try again.")
		return redirect("login")
	if request.GET.get("error"):
		messages.error(request, "Google sign-in was cancelled or failed.")
		return redirect("login")
	try:
		code = request.GET.get("code")
		if not code:
			raise ValueError("Google callback code missing")
		token_response = google_oauth_exchange(code)
		if "error" in token_response or not token_response.get("access_token"):
			raise ValueError(token_response.get("error", "Google access token missing"))
		userinfo = google_oauth_userinfo(token_response["access_token"])
		claims = _decode_jwt_claims(token_response.get("id_token", ""))
		if claims:
			userinfo.setdefault("sub", claims.get("sub"))
			userinfo.setdefault("email", claims.get("email", ""))
			userinfo.setdefault("name", claims.get("name") or claims.get("email", "").split("@", 1)[0])
		user = _resolve_or_create_provider_user("google", userinfo, request)
		login(request, user)
		request.session.cycle_key()
		messages.success(request, "You are signed in with Google.")
		return redirect(_safe_redirect_url(request, request.session.get("oauth_next", "/")))
	except Exception:
		messages.error(request, "Google sign-in could not be completed. Please try again.")
		return redirect("login")


def apple_login_start(request):
	request.session["oauth_next"] = _safe_redirect_url(request, "/")
	if not _provider_is_configured("apple"):
		messages.error(request, "Apple sign-in is not available right now. Please use your GGz password.")
		return redirect("login")
	redirect_uri = settings.APPLE_REDIRECT_URI or _build_provider_redirect_url("apple")
	state = _safe_provider_state(request, "apple")
	nonce = secrets.token_urlsafe(16)
	request.session["oauth_nonce_apple"] = nonce
	params = {
		"client_id": settings.APPLE_CLIENT_ID,
		"redirect_uri": redirect_uri,
		"response_type": "code",
		"scope": "name email",
		"response_mode": "query",
		"state": state,
		"nonce": nonce,
	}
	return redirect(f"https://appleid.apple.com/auth/authorize?{urlencode(params)}")


def apple_login_callback(request):
	state = request.POST.get("state") or request.GET.get("state")
	if state != request.session.get("oauth_state_apple"):
		messages.error(request, "Apple sign-in was interrupted; please try again.")
		return redirect("login")
	if request.POST.get("error") or request.GET.get("error"):
		messages.error(request, "Apple sign-in was cancelled or failed.")
		return redirect("login")
	try:
		code = request.POST.get("code") or request.GET.get("code")
		if not code:
			raise ValueError("Apple callback code missing")
		token_response = apple_oauth_exchange(code)
		if "error" in token_response or not token_response.get("id_token"):
			raise ValueError(token_response.get("error", "Apple identity token missing"))
		userinfo = apple_oauth_userinfo(token_response["id_token"])
		user = _resolve_or_create_provider_user("apple", userinfo, request)
		login(request, user)
		request.session.cycle_key()
		messages.success(request, "You are signed in with Apple.")
		return redirect(_safe_redirect_url(request, request.session.get("oauth_next", "/")))
	except Exception:
		messages.error(request, "Apple sign-in could not be completed. Please try again.")
		return redirect("login")


def unlink_provider(request, provider):
	if provider not in {"google", "apple"}:
		return redirect("account_security")
	if not request.user.is_authenticated:
		return redirect("login")
	if request.method != "POST":
		return redirect("account_security")
	identity = SocialIdentity.objects.filter(user=request.user, provider=provider).first()
	if not identity:
		messages.error(request, f"No {provider.title()} account connected.")
		return redirect("account_security")
	if request.user.social_identities.exclude(provider=provider).count() == 0 and not request.user.has_usable_password():
		messages.error(request, f"You cannot unlink your only sign-in method for {provider.title()}. Add a password or another provider first.")
		return redirect("account_security")
	identity.delete()
	messages.success(request, f"{provider.title()} has been disconnected from your account.")
	return redirect("account_security")


def ggz_password_reset(request):
	form = PasswordResetForm(request.POST or None)
	if request.method == "POST" and form.is_valid():
		form.save(
			request=request,
			subject_template_name="registration/password_reset_subject.txt",
			email_template_name="registration/password_reset_email.html",
			from_email=settings.DEFAULT_FROM_EMAIL,
			use_https=request.is_secure(),
		)
		messages.success(request, "If that account exists, a password reset email has been sent.")
		return redirect("password_reset_done")
	return render(request, "registration/password_reset_form.html", {"form": form})


def ggz_password_reset_done(request):
	return render(request, "registration/password_reset_done.html")


def ggz_password_reset_complete(request):
	return render(request, "registration/password_reset_complete.html")


def ggz_password_change_done(request):
	return render(request, "registration/password_change_done.html")


def ggz_password_reset_confirm(request, uidb64, token):
	try:
		uid = force_str(urlsafe_base64_decode(uidb64))
		user = User.objects.get(pk=uid)
	except (TypeError, ValueError, OverflowError, User.DoesNotExist):
		user = None

	if user is not None and default_token_generator.check_token(user, token):
		form = SetPasswordForm(user, request.POST or None)
		if request.method == "POST" and form.is_valid():
			form.save()
			messages.success(request, "Your password has been reset. You can now sign in.")
			return redirect("login")
		return render(request, "registration/password_reset_confirm.html", {"form": form, "validlink": True})
	return render(request, "registration/password_reset_confirm.html", {"form": None, "validlink": False})


def ggz_password_change(request):
	if not request.user.is_authenticated:
		return redirect("login")
	form = PasswordChangeForm(request.user, request.POST or None)
	if request.method == "POST" and form.is_valid():
		form.save()
		logout(request)
		messages.success(request, "Your password was changed. Please sign in again.")
		return redirect("password_change_done")
	return render(request, "registration/password_change_form.html", {"form": form})


@login_required
def account_security(request):
	if request.method == "POST" and request.POST.get("form_name") == "presence-settings":
		profile = get_object_or_404(GamerProfile, user=request.user)
		presence, _ = GamerPresence.objects.get_or_create(profile=profile)
		presence.show_online_status = request.POST.get("show_online_status") == "on"
		presence.show_last_seen = request.POST.get("show_last_seen") == "on"
		presence.save(update_fields=("show_online_status", "show_last_seen", "updated_at"))
		messages.success(request, "Presence privacy settings updated.")
		return redirect("account_security")
	providers = []
	for provider in ("google", "apple"):
		connected = SocialIdentity.objects.filter(user=request.user, provider=provider).first()
		providers.append({
			"provider": provider,
			"name": provider.title(),
			"connected": bool(connected),
			"display_name": connected.display_name if connected else "",
			"available": _provider_is_configured(provider),
		})
	profile = get_object_or_404(GamerProfile, user=request.user)
	presence, _ = GamerPresence.objects.get_or_create(profile=profile)
	return render(request, "accounts/security.html", {"user": request.user, "providers": providers, "presence_settings": presence})
