"""Twitch Helix live-stream integration for GGz Live.

Public contract (mirrors ``games.services.igdb`` — all calls degrade
gracefully, secrets stay server-side):

- ``is_configured()``: are Twitch client credentials available?
- ``get_game_category(game)``: resolve a GGz ``Game`` to a Twitch category
  ``{"id", "name"}``; ``None`` when unmapped or unavailable. Resolution order:
  persisted ``game.twitch_category_id`` → IGDB id lookup → exact name →
  normalized name → no match (negatively cached).
- ``get_live_streams(game=None, channel=None, first, language)``: normalized
  stream dicts (GGz-owned shape); ``[]`` when disabled, throttled, or empty.
- ``normalize_stream(record)``: one Twitch record → GGz shape.

Token acquisition, API calls, caching and error handling all live here so
views never talk to Twitch directly and never log credentials. Designed so a
future EventSub integration can reuse ``_client_id``/``_get_access_token``.
"""

import json
import logging
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger("games.services.twitch")

_TOKEN_CACHE_KEY = "twitch:access_token"
_SYMBOL_PATTERN = re.compile(r"[™®©]")
_WS_PATTERN = re.compile(r"\s+")


class TwitchError(Exception):
    """Base class for Twitch service failures."""


class TwitchConfigurationError(TwitchError):
    """Twitch client credentials are not configured."""


class TwitchAuthenticationError(TwitchError):
    """Twitch refused our credentials."""


class TwitchUnavailableError(TwitchError):
    """Network or server-side failure talking to Twitch."""


class TwitchRateLimitedError(TwitchUnavailableError):
    """Twitch throttled the request (429)."""


def _client_id():
    value = (getattr(settings, "TWITCH_CLIENT_ID", "") or "").strip()
    if value:
        return value
    if getattr(settings, "TWITCH_DISABLE_IGDB_FALLBACK", False):
        return ""
    return (getattr(settings, "IGDB_CLIENT_ID", "") or "").strip()


def _client_secret():
    value = (getattr(settings, "TWITCH_CLIENT_SECRET", "") or "").strip()
    if value:
        return value
    if getattr(settings, "TWITCH_DISABLE_IGDB_FALLBACK", False):
        return ""
    return (getattr(settings, "IGDB_CLIENT_SECRET", "") or "").strip()


def is_configured():
    return bool(_client_id() and _client_secret())


# -- auth ------------------------------------------------------------------

def _get_access_token():
    """Return a cached app access token, reacquiring it when absent/expired."""
    if not is_configured():
        raise TwitchConfigurationError("Twitch credentials are not configured")

    token = cache.get(_TOKEN_CACHE_KEY)
    if token:
        return token

    payload = urlencode(
        {
            "client_id": _client_id(),
            "client_secret": _client_secret(),
            "grant_type": "client_credentials",
        }
    ).encode("utf-8")
    request = Request(settings.TWITCH_AUTH_URL, data=payload, method="POST")
    request.add_header("Content-Type", "application/x-www-form-urlencoded")
    request.add_header("Accept", "application/json")

    try:
        with urlopen(request, timeout=settings.TWITCH_TIMEOUT) as response:
            raw = response.read()
    except HTTPError as exc:
        raise TwitchAuthenticationError(
            f"Twitch token request failed with HTTP {exc.code}"
        ) from exc
    except (URLError, OSError) as exc:
        raise TwitchUnavailableError(f"Twitch token endpoint unreachable: {exc}") from exc

    try:
        body = json.loads(raw.decode("utf-8", errors="replace"))
    except ValueError as exc:
        raise TwitchAuthenticationError("Twitch token endpoint returned invalid JSON") from exc

    if not isinstance(body, dict) or not body.get("access_token"):
        raise TwitchAuthenticationError("Twitch token endpoint returned no access_token")

    expires_in = 3600
    try:
        expires_in = int(body.get("expires_in") or expires_in)
    except (TypeError, ValueError):
        pass
    ttl = max(expires_in - 120, 60)
    cache.set(_TOKEN_CACHE_KEY, body["access_token"], timeout=ttl)
    return body["access_token"]


def _helix_get(endpoint, params=None, _retried=False):
    """GET one Helix endpoint; typed exceptions, single 401 retry, no secrets in logs."""
    try:
        access_token = _get_access_token()
    except TwitchError:
        raise
    except (URLError, OSError, ValueError) as exc:
        raise TwitchUnavailableError(f"Twitch authentication unavailable: {exc}") from exc

    query = urlencode(params or {})
    url = f"{settings.TWITCH_API_BASE_URL.rstrip('/')}/{endpoint.lstrip('/')}"
    if query:
        url = f"{url}?{query}"
    request = Request(url, method="GET")
    request.add_header("Client-ID", _client_id())
    request.add_header("Authorization", f"Bearer {access_token}")
    request.add_header("Accept", "application/json")
    request.add_header("User-Agent", "GGz Gamer Hub/1.0")

    try:
        with urlopen(request, timeout=settings.TWITCH_TIMEOUT) as response:
            raw = response.read()
    except HTTPError as exc:
        if exc.code == 401 and not _retried:
            cache.delete(_TOKEN_CACHE_KEY)
            logger.info("Twitch token rejected on %s; reacquiring once", endpoint)
            return _helix_get(endpoint, params, _retried=True)
        if exc.code == 429:
            logger.warning("Twitch rate limited (HTTP 429) on %s", endpoint)
            raise TwitchRateLimitedError(f"Twitch rate limited on {endpoint}") from exc
        logger.error("Twitch HTTP %s on %s", exc.code, endpoint)
        raise TwitchUnavailableError(f"Twitch HTTP {exc.code} on {endpoint}") from exc
    except (URLError, OSError) as exc:
        logger.error("Twitch unreachable for %s: %s", endpoint, exc)
        raise TwitchUnavailableError(f"Twitch unreachable for {endpoint}: {exc}") from exc

    if not raw:
        return {}
    try:
        body = json.loads(raw.decode("utf-8", errors="replace"))
    except ValueError as exc:
        logger.error("Twitch returned invalid JSON for %s", endpoint)
        raise TwitchUnavailableError(f"Twitch returned invalid JSON for {endpoint}") from exc
    if not isinstance(body, dict):
        raise TwitchUnavailableError(f"Twitch returned an unexpected payload for {endpoint}")
    return body


# -- normalization ---------------------------------------------------------

def _as_text(value, limit=None):
    if value is None:
        return ""
    text = _WS_PATTERN.sub(" ", str(value)).strip()
    if limit:
        text = text[:limit]
    return text


def _as_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def normalize_stream(record):
    """One Twitch Helix stream record → the GGz-owned stream shape."""
    if not isinstance(record, dict):
        return None
    thumbnail = _as_text(record.get("thumbnail_url"))
    thumbnail = thumbnail.replace("{width}", "320").replace("{height}", "180")
    broadcaster_login = _as_text(record.get("user_login") or record.get("broadcaster_login"), limit=80)
    if not broadcaster_login and not record.get("id"):
        return None
    return {
        "id": _as_text(record.get("id"), limit=64),
        "broadcaster_id": _as_text(record.get("user_id") or record.get("broadcaster_id"), limit=64),
        "broadcaster_login": broadcaster_login,
        "broadcaster_name": _as_text(record.get("user_name") or record.get("broadcaster_name"), limit=100),
        "game_id": _as_text(record.get("game_id"), limit=64),
        "game_name": _as_text(record.get("game_name"), limit=120),
        "title": _as_text(record.get("title"), limit=300),
        "viewer_count": max(_as_int(record.get("viewer_count")), 0),
        "language": _as_text(record.get("language"), limit=16),
        "thumbnail_url": thumbnail[:500],
        "started_at": _as_text(record.get("started_at"), limit=40),
        "is_live": True,
    }


def _normalize_streams(payload):
    data = payload.get("data") if isinstance(payload, dict) else None
    streams = []
    for record in data if isinstance(data, list) else []:
        normalized = normalize_stream(record)
        if normalized:
            streams.append(normalized)
    streams.sort(key=lambda item: item["viewer_count"], reverse=True)
    return streams


def _normalize_category(record):
    if not isinstance(record, dict):
        return None
    try:
        category_id = int(record.get("id"))
    except (TypeError, ValueError):
        return None
    if not category_id:
        return None
    return {"id": category_id, "name": _as_text(record.get("name"), limit=120)}


def _category_cache_key(game):
    return f"twitch:category:game:{game.id}"


def _resolve_category_upstream(game):
    """Try IGDB id, then exact name, then normalized name. None on no match."""
    if game.igdb_id:
        try:
            payload = _helix_get("games", {"igdb_id": int(game.igdb_id)})
        except TwitchError as exc:
            logger.info("Twitch category lookup by IGDB id for %s unavailable: %s", game.name, exc)
            payload = None
        if isinstance(payload, dict):
            for record in payload.get("data") or []:
                category = _normalize_category(record)
                if category:
                    return category

    attempts = []
    original = _as_text(game.name)
    if original:
        attempts.append(original)
    normalized = _WS_PATTERN.sub(" ", _SYMBOL_PATTERN.sub("", original)).strip()
    if normalized and normalized != original:
        attempts.append(normalized)

    for attempt in attempts:
        try:
            payload = _helix_get("games", {"name": attempt})
        except TwitchError as exc:
            logger.info("Twitch category lookup by name for %s unavailable: %s", attempt, exc)
            continue
        if isinstance(payload, dict):
            for record in payload.get("data") or []:
                category = _normalize_category(record)
                if category:
                    return category
    return None


def get_game_category(game):
    """Resolve (and cache, and persist) a GGz game's Twitch category."""
    if game is None:
        return None

    if game.twitch_category_id:
        return {
            "id": int(game.twitch_category_id),
            "name": _as_text(game.twitch_category_name, limit=120),
        }

    if not is_configured():
        return None

    cache_key = _category_cache_key(game)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached or None

    category = _resolve_category_upstream(game)
    if category is None:
        cache.set(cache_key, {}, timeout=settings.TWITCH_CATEGORY_MISS_CACHE_SECONDS)
        return None

    # Persist so the next request (and every future page render) skips Twitch.
    if not game.twitch_category_id:
        game.twitch_category_id = category["id"]
        game.twitch_category_name = category["name"] or ""
        game.save(update_fields=["twitch_category_id", "twitch_category_name"])
    cache.set(cache_key, category, timeout=settings.TWITCH_CATEGORY_CACHE_SECONDS)
    return category


# -- stream discovery ------------------------------------------------------

def get_live_streams(game=None, channel=None, first=20, language=None):
    """Normalized live streams, cached per filter combination.

    Returns ``[]`` for unconfigured, unmapped, throttled, failing, or simply
    nobody-live cases so callers always render a usable page.
    """
    if not is_configured():
        return []

    try:
        first = max(1, min(int(first), 50))
    except (TypeError, ValueError):
        first = 20

    language = _as_text(language, limit=16).lower()
    if language and not re.fullmatch(r"[a-z-]{2,16}", language):
        language = ""

    params = {"first": first}
    cache_parts = ["twitch:streams"]

    if channel is not None:
        channel = _as_text(channel, limit=80).lower()
        if not channel:
            return []
        params["user_login"] = channel
        cache_parts.append(f"channel:{channel}")
    elif game is not None:
        category = get_game_category(game)
        if not category:
            return []
        params["game_id"] = str(category["id"])
        cache_parts.append(f"game:{category['id']}")
    cache_parts.append(f"lang:{language or 'any'}")
    cache_key = ":".join(cache_parts)

    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    if language:
        params["language"] = language

    try:
        payload = _helix_get("streams", params)
    except TwitchError as exc:
        logger.info("Twitch stream discovery unavailable: %s", exc)
        return []

    streams = _normalize_streams(payload)
    cache.set(cache_key, streams, timeout=settings.TWITCH_STREAM_CACHE_SECONDS)
    return streams
