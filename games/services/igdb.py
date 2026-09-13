"""IGDB (Twitch) game catalogue integration for the GGz games hub.

Public contract (all calls degrade gracefully, mirrors ``accounts.services``):

- ``is_configured()``: are client credentials available?
- ``search_games(query, limit)``: external catalogue results; ``[]`` when
  disabled, throttled, or otherwise unavailable.
- ``get_game(igdb_id)``: one external record; ``None`` when unavailable.
- ``get_related_games(igdb_id)``: similar external titles; ``[]`` when
  unavailable.
- ``import_game(igdb_id)``: create-or-sync a local ``Game`` (deduped by IGDB
  id and then by name); ``None`` when unavailable.
- ``sync_game(game)``: refresh an existing local ``Game``'s IGDB metadata.

All requests use the standard library (matching the repository's external
service pattern) and are cached in Django's default cache so views never call
the API on every page load. Existing local games keep working unchanged when
IGDB is unconfigured or unreachable.
"""

import json
import logging
import re
from datetime import datetime, timezone as dt_timezone
from decimal import Decimal, InvalidOperation
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.utils import timezone

from games.models import Game

logger = logging.getLogger("games.services.igdb")

_ACCESS_TOKEN_CACHE_KEY = "igdb:access_token"
_IMAGE_SIZE_PATTERN = re.compile(r"/t_[a-z0-9_]+/")
_GAME_FIELDS = (
    "name, slug, summary, url, first_release_date, rating, rating_count, "
    "aggregated_rating, cover.url, genres.name, platforms.name, "
    "screenshots.url, similar_games"
)


class IGDBError(Exception):
    """Base class for IGDB service failures."""


class IGDBConfigurationError(IGDBError):
    """IGDB client credentials are not configured."""


class IGDBAuthenticationError(IGDBError):
    """IGDB refused our credentials."""


class IGDBUnavailableError(IGDBError):
    """Network or server-side failure talking to IGDB."""


class IGDBRateLimitedError(IGDBUnavailableError):
    """IGDB throttled the request (429/503)."""


def is_configured():
    return bool(
        (getattr(settings, "IGDB_CLIENT_ID", "") or "").strip()
        and (getattr(settings, "IGDB_CLIENT_SECRET", "") or "").strip()
    )


# -- auth ------------------------------------------------------------------

def _get_access_token():
    """Return an IGDB bearer token, refreshing it from the cache when valid."""
    token = cache.get(_ACCESS_TOKEN_CACHE_KEY)
    if token:
        return token

    payload = urlencode(
        {
            "client_id": settings.IGDB_CLIENT_ID,
            "client_secret": settings.IGDB_CLIENT_SECRET,
            "grant_type": "client_credentials",
        }
    ).encode("utf-8")
    request = Request(settings.IGDB_AUTH_URL, data=payload, method="POST")
    request.add_header("Content-Type", "application/x-www-form-urlencoded")
    request.add_header("Accept", "application/json")

    try:
        with urlopen(request, timeout=settings.IGDB_TIMEOUT) as response:
            raw = response.read()
    except HTTPError as exc:
        raise IGDBAuthenticationError(
            f"IGDB token request failed with HTTP {exc.code}"
        ) from exc
    except (URLError, OSError) as exc:
        raise IGDBUnavailableError(f"IGDB token endpoint unreachable: {exc}") from exc

    try:
        body = json.loads(raw.decode("utf-8", errors="replace"))
    except ValueError as exc:
        raise IGDBAuthenticationError("IGDB token endpoint returned invalid JSON") from exc

    if not isinstance(body, dict) or not body.get("access_token"):
        raise IGDBAuthenticationError("IGDB token endpoint returned no access_token")

    expires_in = 3600
    try:
        expires_in = int(body.get("expires_in") or expires_in)
    except (TypeError, ValueError):
        pass
    ttl = max(expires_in - 120, 300)
    cache.set(_ACCESS_TOKEN_CACHE_KEY, body["access_token"], timeout=ttl)
    return body["access_token"]


def _post_query(query, endpoint="games", _retried=False):
    """POST an IGDB Apicalypse query; typed exceptions on failure."""
    try:
        access_token = _get_access_token()
    except (URLError, OSError, ValueError) as exc:
        raise IGDBUnavailableError(f"IGDB authentication unavailable: {exc}") from exc

    url = f"{settings.IGDB_BASE_URL.rstrip('/')}/{endpoint}"
    request = Request(url, data=query.encode("utf-8"), method="POST")
    request.add_header("Client-ID", settings.IGDB_CLIENT_ID)
    request.add_header("Authorization", f"Bearer {access_token}")
    request.add_header("Content-Type", "text/plain")
    request.add_header("Accept", "application/json")
    request.add_header("User-Agent", "GGz Gamer Hub/1.0")

    try:
        with urlopen(request, timeout=settings.IGDB_TIMEOUT) as response:
            raw = response.read()
    except HTTPError as exc:
        if exc.code == 401 and not _retried:
            cache.delete(_ACCESS_TOKEN_CACHE_KEY)
            logger.info("IGDB token rejected on %s; refreshing once", endpoint)
            return _post_query(query, endpoint, _retried=True)
        if exc.code in (429, 503):
            logger.warning("IGDB rate limited (HTTP %s) on %s", exc.code, endpoint)
            raise IGDBRateLimitedError(
                f"IGDB rate limited (HTTP {exc.code}) on {endpoint}"
            ) from exc
        detail = ""
        try:
            detail = exc.read().decode("utf-8", errors="replace")[:200]
        except Exception:
            pass
        logger.error("IGDB HTTP %s on %s: %s", exc.code, endpoint, detail)
        raise IGDBUnavailableError(f"IGDB HTTP {exc.code} on {endpoint}: {detail}") from exc
    except (URLError, OSError) as exc:
        logger.error("IGDB unreachable for %s: %s", endpoint, exc)
        raise IGDBUnavailableError(f"IGDB unreachable for {endpoint}: {exc}") from exc

    if not raw:
        return []
    try:
        return json.loads(raw.decode("utf-8", errors="replace"))
    except ValueError as exc:
        logger.error("IGDB returned invalid JSON for %s", endpoint)
        raise IGDBUnavailableError(f"IGDB returned invalid JSON for {endpoint}") from exc


# -- helpers ---------------------------------------------------------------

def _as_text(value, limit=None):
    if value is None:
        return ""
    if isinstance(value, list):
        value = ", ".join(str(item) for item in value if item)
    text = re.sub(r"\s+", " ", str(value)).strip()
    if limit:
        text = text[:limit]
    return text


def _names(records):
    names = []
    for record in records or []:
        if isinstance(record, dict) and record.get("name"):
            names.append(_as_text(record["name"]))
    return ", ".join(dict.fromkeys(names))


def _parse_release_date(value):
    if not value:
        return None, None
    try:
        parsed = datetime.fromtimestamp(int(value), tz=dt_timezone.utc).date()
    except (TypeError, ValueError, OverflowError, OSError):
        return None, None
    return parsed, parsed.year


def _image_url(value, size="t_cover_big"):
    url = _as_text(value)
    if not url:
        return ""
    if url.startswith("//"):
        url = "https:" + url
    return _IMAGE_SIZE_PATTERN.sub(f"/{size}/", url)


def _company_names(records):
    developers, publishers = [], []
    for record in records or []:
        if not isinstance(record, dict):
            continue
        name = _as_text((record.get("company") or {}).get("name"))
        if not name:
            continue
        if record.get("developer"):
            developers.append(name)
        if record.get("publisher"):
            publishers.append(name)
    return ", ".join(dict.fromkeys(developers)), ", ".join(dict.fromkeys(publishers))


def _normalize_catalog(record):
    """Flatten an IGDB ``games`` record into a compact, cache-friendly dict."""
    cover_url = ""
    cover = record.get("cover") if isinstance(record, dict) else None
    if isinstance(cover, dict):
        cover_url = _image_url(cover.get("url"))

    rating = record.get("rating") or record.get("aggregated_rating")
    rating = round(float(rating), 1) if rating is not None else None

    rating_count = record.get("rating_count")
    try:
        rating_count = int(rating_count) if rating_count is not None else None
    except (TypeError, ValueError):
        rating_count = None

    release_date, release_year = _parse_release_date(record.get("first_release_date"))
    igdb_id = record.get("id")
    try:
        igdb_id = int(igdb_id)
    except (TypeError, ValueError):
        igdb_id = None

    screenshots = []
    for shot in record.get("screenshots") or []:
        if isinstance(shot, dict) and shot.get("url"):
            screenshots.append(_image_url(shot.get("url"), size="t_screenshot_big"))

    return {
        "igdb_id": igdb_id,
        "name": _as_text(record.get("name")) or ("Game %s" % igdb_id if igdb_id else ""),
        "slug": _as_text(record.get("slug"), limit=120),
        "igdb_url": _as_text(record.get("url"), limit=500),
        "cover_url": cover_url,
        "summary": _as_text(record.get("summary")),
        "genres": _names(record.get("genres")),
        "platforms": _names(record.get("platforms")),
        "rating": rating,
        "rating_count": rating_count,
        "release_date": release_date.isoformat() if release_date else None,
        "release_year": release_year,
        "screenshots": screenshots[:6],
        "developers": "",
        "publishers": "",
    }


def _local_games_by_igdb_ids(igdb_ids):
    ids = [int(value) for value in igdb_ids if value]
    if not ids:
        return {}
    return dict(Game.objects.filter(igdb_id__in=ids).values_list("igdb_id", "id"))


# -- public API ------------------------------------------------------------

def search_games(query, limit=8):
    if not is_configured():
        return []
    query_text = _as_text(query)
    if not query_text:
        return []

    cache_key = f"igdb:search:{query_text.lower()[:120]}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    escaped = query_text.replace("\\", "\\\\").replace('"', '\\"')
    body = f'search "{escaped}"; fields {_GAME_FIELDS}; limit {int(limit)};'
    try:
        records = _post_query(body, endpoint="games")
    except IGDBError as exc:
        logger.info("IGDB search '%s' unavailable: %s", query_text, exc)
        return []

    results = [_normalize_catalog(record) for record in records if isinstance(record, dict) and record.get("id")]
    if results:
        cache.set(cache_key, results, timeout=settings.IGDB_SEARCH_CACHE_SECONDS)
    return results


def get_game(igdb_id):
    if not is_configured():
        return None
    try:
        igdb_id = int(igdb_id)
    except (TypeError, ValueError):
        return None

    cache_key = f"igdb:game:{igdb_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        records = _post_query(
            f"where id = {igdb_id}; fields {_GAME_FIELDS}; limit 1;", endpoint="games"
        )
        company_records = _post_query(
            f"where game = {igdb_id}; fields company.name, developer, publisher; limit 25;",
            endpoint="involved_companies",
        )
    except IGDBError as exc:
        logger.info("IGDB game %s unavailable: %s", igdb_id, exc)
        return None

    if not records:
        cache.set(cache_key, {}, timeout=settings.IGDB_GAME_CACHE_SECONDS)
        return None

    result = _normalize_catalog(records[0])
    developers, publishers = _company_names(company_records)
    result["developers"] = developers
    result["publishers"] = publishers
    cache.set(cache_key, result, timeout=settings.IGDB_GAME_CACHE_SECONDS)
    return result


def get_related_games(igdb_id, limit=6):
    if not is_configured():
        return []
    try:
        igdb_id = int(igdb_id)
    except (TypeError, ValueError):
        return []

    cache_key = f"igdb:related:{igdb_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        records = _post_query(
            f"where id = {igdb_id}; fields similar_games; limit 1;", endpoint="games"
        )
        related_ids = [int(value) for value in (records[0].get("similar_games") or []) if value][:limit]
    except (IGDBError, IndexError, AttributeError, TypeError, ValueError):
        return []

    if not related_ids:
        return []

    try:
        records = _post_query(
            f"where id = ({','.join(str(value) for value in related_ids)}); "
            f"fields name, slug, url, cover.url, first_release_date, rating; "
            f"limit {len(related_ids)};",
            endpoint="games",
        )
    except IGDBError as exc:
        logger.info("IGDB related games for %s unavailable: %s", igdb_id, exc)
        return []

    results = [_normalize_catalog(record) for record in records if isinstance(record, dict) and record.get("id")]
    results = results[:limit]
    local_map = _local_games_by_igdb_ids([item["igdb_id"] for item in results])
    for item in results:
        item["local_id"] = local_map.get(item["igdb_id"])
    if results:
        cache.set(cache_key, results, timeout=settings.IGDB_GAME_CACHE_SECONDS)
    return results


def _apply_external(game, external):
    """Write only curated-blank fields plus always-safe IGDB metadata."""
    game.name = external.get("name") or game.name
    game.igdb_id = external.get("igdb_id")
    game.igdb_slug = external.get("slug") or ""
    game.igdb_url = external.get("igdb_url") or ""
    game.igdb_genres = external.get("genres") or ""
    game.igdb_platforms = external.get("platforms") or ""
    game.igdb_summary = external.get("summary") or ""

    rating = external.get("rating")
    if rating is not None:
        try:
            game.igdb_rating = Decimal(str(rating)).quantize(Decimal("0.1"))
        except (InvalidOperation, ValueError):
            game.igdb_rating = None
    else:
        game.igdb_rating = None
    game.igdb_rating_count = external.get("rating_count")

    release_date = external.get("release_date")
    if isinstance(release_date, str) and release_date:
        try:
            game.igdb_release_date = datetime.strptime(release_date, "%Y-%m-%d").date()
        except ValueError:
            game.igdb_release_date = None
    else:
        game.igdb_release_date = release_date or None

    if not game.cover_art_url and external.get("cover_url"):
        game.cover_art_url = external.get("cover_url")
    if not game.description and external.get("summary"):
        game.description = external["summary"][:300]
    if not game.genre and external.get("genres"):
        game.genre = external["genres"].split(", ")[0][:100]
    if not game.platform and external.get("platforms"):
        game.platform = external["platforms"].split(", ")[0][:100]
    if not game.developer and external.get("developers"):
        game.developer = external["developers"][:100]
    if not game.publisher and external.get("publishers"):
        game.publisher = external["publishers"][:100]
    if not game.release_year and external.get("release_year"):
        game.release_year = external["release_year"]
    return game


def import_game(igdb_id):
    """Create-or-sync a local Game from the catalogue (deduped by id then name)."""
    try:
        igdb_id = int(igdb_id)
    except (TypeError, ValueError):
        return None

    external = get_game(igdb_id)
    if not external:
        return None

    try:
        with transaction.atomic():
            game = Game.objects.select_for_update().filter(igdb_id=igdb_id).first()
            if game is None:
                game = (
                    Game.objects.select_for_update()
                    .filter(name__iexact=external["name"])
                    .first()
                )
            if game is None:
                game = Game(name=external["name"])
            _apply_external(game, external)
            game.igdb_last_synced = timezone.now()
            game.save()
    except IntegrityError:
        return Game.objects.filter(igdb_id=igdb_id).first()

    get_related_games(igdb_id)
    return game


def sync_game(game):
    """Refresh an existing Game's IGDB metadata (by id, or best-match by name)."""
    if not is_configured():
        return None
    if game.igdb_id:
        external = get_game(game.igdb_id)
    else:
        matches = search_games(game.name, limit=1)
        external = matches[0] if matches else None
    if not external:
        return None
    _apply_external(game, external)
    game.igdb_last_synced = timezone.now()
    game.save()
    return game