"""Tests for the Twitch Helix live-stream integration (GGz Live).

All upstream traffic is stubbed at ``games.services.twitch.urlopen`` — no test
ever touches the real Twitch API, and no real credentials are required.
"""

import io
import json
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse

from games.models import Game
from games.services import twitch

TEST_SETTINGS = {
    "TWITCH_CLIENT_ID": "test-twitch-client",
    "TWITCH_CLIENT_SECRET": "test-twitch-secret",
    "TWITCH_DISABLE_IGDB_FALLBACK": True,
    "IGDB_CLIENT_ID": "",
    "IGDB_CLIENT_SECRET": "",
    "TWITCH_AUTH_URL": "https://twitch.test/oauth2/token",
    "TWITCH_API_BASE_URL": "https://twitch.test/helix",
    "TWITCH_TIMEOUT": 3,
    "TWITCH_STREAM_CACHE_SECONDS": 60,
    "TWITCH_CATEGORY_CACHE_SECONDS": 604800,
    "TWITCH_CATEGORY_MISS_CACHE_SECONDS": 86400,
}

TOKEN_BODY = {"access_token": "test-access-token", "expires_in": 3600}

STREAM_RECORDS = [
    {
        "id": "4001",
        "user_id": "9001",
        "user_login": "hararehero",
        "user_name": "HarareHero",
        "game_id": "510913",
        "game_name": "VALORANT",
        "title": "Road to Radiant",
        "viewer_count": 1200,
        "language": "en",
        "thumbnail_url": "https://static-cdn.jtvnw.net/previews-ttv/live_user_hararehero-{width}x{height}.jpg",
        "started_at": "2026-09-24T10:00:00Z",
        "type": "live",
        "is_mature": False,
    },
    {
        "id": "4002",
        "user_id": "9002",
        "user_login": "bulawayoboy",
        "user_name": "BulawayoBoy",
        "game_id": "32982",
        "game_name": "Grand Theft Auto V",
        "title": "City runs",
        "viewer_count": 640,
        "language": "en",
        "thumbnail_url": "https://static-cdn.jtvnw.net/previews-ttv/live_user_bulawayoboy-{width}x{height}.jpg",
        "started_at": "2026-09-24T09:30:00Z",
        "type": "live",
        "is_mature": False,
    },
]


def _json_response(body):
    if not isinstance(body, bytes):
        body = json.dumps(body).encode("utf-8")
    return io.BytesIO(body)


def _http_error(url, code):
    return HTTPError(url, code, f"HTTP {code}", None, None)


def _query(req):
    return parse_qs(urlparse(req.full_url).query)


def _make_urlopen(routes):
    """routes: list of (predicate, handler). handler(req) -> bytes-response or raises."""
    calls = []

    def fake_urlopen(req, timeout=None):
        calls.append(req.full_url)
        for predicate, handler in routes:
            if predicate(req):
                result = handler(req) if callable(handler) else handler
                if isinstance(result, Exception):
                    raise result
                return result
        raise AssertionError(f"unexpected upstream request: {req.full_url}")

    fake_urlopen.calls = calls
    return fake_urlopen


def _is_token(req):
    return "/oauth2/token" in req.full_url


def _is_streams(req):
    return "/helix/streams" in req.full_url


def _is_games(req):
    return "/helix/games" in req.full_url


def _never(req):
    raise AssertionError(f"network should not be touched: {req.full_url}")


@override_settings(**TEST_SETTINGS)
class TwitchConfigTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_not_configured_when_credentials_disabled(self):
        with override_settings(
            TWITCH_CLIENT_ID="",
            TWITCH_CLIENT_SECRET="",
            TWITCH_DISABLE_IGDB_FALLBACK=True,
        ):
            self.assertFalse(twitch.is_configured())

    def test_falls_back_to_igdb_credentials(self):
        with override_settings(
            TWITCH_CLIENT_ID="",
            TWITCH_CLIENT_SECRET="",
            TWITCH_DISABLE_IGDB_FALLBACK=False,
            IGDB_CLIENT_ID="shared-client-id",
            IGDB_CLIENT_SECRET="shared-secret",
        ):
            self.assertTrue(twitch.is_configured())

    def test_disabled_fallback_ignores_igdb_credentials(self):
        with override_settings(
            TWITCH_CLIENT_ID="",
            TWITCH_CLIENT_SECRET="",
            TWITCH_DISABLE_IGDB_FALLBACK=True,
            IGDB_CLIENT_ID="shared-client-id",
            IGDB_CLIENT_SECRET="shared-secret",
        ):
            self.assertFalse(twitch.is_configured())

    def test_streams_empty_without_upstream_when_unconfigured(self):
        with override_settings(
            TWITCH_CLIENT_ID="",
            TWITCH_CLIENT_SECRET="",
            TWITCH_DISABLE_IGDB_FALLBACK=True,
        ):
            with patch_urlopen(_never):
                self.assertEqual(twitch.get_live_streams(), [])
                self.assertIsNone(
                    twitch.get_game_category(Game(name="Anything", igdb_id=1))
                )

    def test_persisted_category_works_without_credentials(self):
        game = Game.objects.create(name="VALORANT", twitch_category_id=510913)
        with override_settings(
            TWITCH_CLIENT_ID="",
            TWITCH_CLIENT_SECRET="",
            TWITCH_DISABLE_IGDB_FALLBACK=True,
        ):
            category = twitch.get_game_category(game)
        self.assertEqual(category, {"id": 510913, "name": ""})


@override_settings(**TEST_SETTINGS)
class TwitchTokenTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_token_acquired_once_and_cached(self):
        hits = {"count": 0}

        def token_handler(req):
            hits["count"] += 1
            return _json_response(TOKEN_BODY)

        fake = _make_urlopen([(_is_token, token_handler)])
        with patch_urlopen(fake):
            first = twitch._get_access_token()
            second = twitch._get_access_token()
        self.assertEqual(first, "test-access-token")
        self.assertEqual(second, "test-access-token")
        self.assertEqual(hits["count"], 1)

    def test_token_endpoint_invalid_json_raises_auth_error(self):
        fake = _make_urlopen([(_is_token, io.BytesIO(b"not-json"))])
        with patch_urlopen(fake):
            with self.assertRaises(twitch.TwitchAuthenticationError):
                twitch._get_access_token()

    def test_token_endpoint_http_error_raises_auth_error(self):
        fake = _make_urlopen([(_is_token, _http_error("https://twitch.test/oauth2/token", 400))])
        with patch_urlopen(fake):
            with self.assertRaises(twitch.TwitchAuthenticationError):
                twitch._get_access_token()

    def test_unconfigured_token_raises_configuration_error(self):
        with override_settings(
            TWITCH_CLIENT_ID="",
            TWITCH_CLIENT_SECRET="",
            TWITCH_DISABLE_IGDB_FALLBACK=True,
        ):
            with self.assertRaises(twitch.TwitchConfigurationError):
                twitch._get_access_token()

    def test_streams_degrade_when_token_acquisition_fails(self):
        fake = _make_urlopen([(_is_token, _http_error("https://twitch.test/oauth2/token", 403))])
        with patch_urlopen(fake):
            self.assertEqual(twitch.get_live_streams(), [])


def patch_urlopen(fake):
    from unittest import mock

    return mock.patch.object(twitch, "urlopen", fake)


@override_settings(**TEST_SETTINGS)
class TwitchStreamTests(TestCase):
    def setUp(self):
        cache.clear()

    @staticmethod
    def _routes(stream_handler, token_body=TOKEN_BODY):
        return [
            (_is_token, lambda req: _json_response(token_body)),
            (_is_streams, stream_handler),
            (_is_games, lambda req: _json_response({"data": []})),
        ]

    def test_success_normalizes_and_sorts_by_viewers(self):
        fake = _make_urlopen(
            self._routes(lambda req: _json_response({"data": list(reversed(STREAM_RECORDS))}))
        )
        with patch_urlopen(fake):
            streams = twitch.get_live_streams()
        self.assertEqual(len(streams), 2)
        self.assertEqual(streams[0]["broadcaster_login"], "hararehero")
        self.assertEqual(streams[0]["viewer_count"], 1200)
        self.assertTrue(streams[0]["is_live"])
        self.assertIn("320x180", streams[0]["thumbnail_url"])
        self.assertNotIn("{width}", streams[0]["thumbnail_url"])
        self.assertEqual(
            set(streams[0].keys()),
            {
                "id",
                "broadcaster_id",
                "broadcaster_login",
                "broadcaster_name",
                "game_id",
                "game_name",
                "title",
                "viewer_count",
                "language",
                "thumbnail_url",
                "started_at",
                "is_live",
            },
        )

    def test_live_streams_cached_across_calls(self):
        hits = {"count": 0}

        def handler(req):
            hits["count"] += 1
            return _json_response({"data": STREAM_RECORDS})

        fake = _make_urlopen(self._routes(handler))
        with patch_urlopen(fake):
            twitch.get_live_streams()
            twitch.get_live_streams()
            twitch.get_live_streams(language="en")
        self.assertEqual(hits["count"], 2)  # default + language variants, not per visitor

    def test_timeout_returns_empty_list(self):
        fake = self._routes(lambda req: URLError("timed out"))
        with patch_urlopen(_make_urlopen(fake)):
            self.assertEqual(twitch.get_live_streams(), [])

    def test_401_reacquires_token_once_then_succeeds(self):
        state = {"first": True}

        def streams_handler(req):
            if state["first"]:
                state["first"] = False
                return _http_error(req.full_url, 401)
            return _json_response({"data": STREAM_RECORDS})

        fake = _make_urlopen(self._routes(streams_handler))
        with patch_urlopen(fake):
            streams = twitch.get_live_streams()
        self.assertEqual(len(streams), 2)
        self.assertEqual(sum("/oauth2/token" in url for url in fake.calls), 2)

    def test_rate_limited_returns_empty_list(self):
        fake = self._routes(lambda req: _http_error(req.full_url, 429))
        with patch_urlopen(_make_urlopen(fake)):
            self.assertEqual(twitch.get_live_streams(), [])

    def test_http_error_returns_empty_list(self):
        fake = self._routes(lambda req: _http_error(req.full_url, 500))
        with patch_urlopen(_make_urlopen(fake)):
            self.assertEqual(twitch.get_live_streams(), [])

    def test_malformed_json_returns_empty_list(self):
        fake = self._routes(lambda req: io.BytesIO(b"<html>oops</html>"))
        with patch_urlopen(_make_urlopen(fake)):
            self.assertEqual(twitch.get_live_streams(), [])

    def test_malformed_records_are_skipped_not_fatal(self):
        payload = {"data": ["junk", None, {"id": "777"}, STREAM_RECORDS[0]]}
        fake = self._routes(lambda req: _json_response(payload))
        with patch_urlopen(_make_urlopen(fake)):
            streams = twitch.get_live_streams()
        logins = [stream["broadcaster_login"] for stream in streams]
        self.assertIn("hararehero", logins)
        self.assertIn("", logins)  # id-only record survives with safe defaults
        self.assertNotIn("junk", logins)

    def test_channel_filter_hits_user_login_param(self):
        fake = _make_urlopen(
            self._routes(
                lambda req: (
                    _json_response({"data": [STREAM_RECORDS[0]]})
                    if _query(req).get("user_login") == ["hararehero"]
                    else _json_response({"data": []})
                )
            )
        )
        with patch_urlopen(fake):
            streams = twitch.get_live_streams(channel="HarareHero")
        self.assertEqual(len(streams), 1)
        self.assertEqual(streams[0]["broadcaster_login"], "hararehero")

    def test_invalid_language_is_ignored(self):
        captured = {}

        def handler(req):
            captured.update(_query(req))
            return _json_response({"data": []})

        fake = _make_urlopen(self._routes(handler))
        with patch_urlopen(fake):
            twitch.get_live_streams(language="en; DROP TABLE")
        self.assertNotIn("language", captured)

    def test_first_is_clamped_to_50(self):
        captured = {}

        def handler(req):
            captured.update(_query(req))
            return _json_response({"data": []})

        fake = _make_urlopen(self._routes(handler))
        with patch_urlopen(fake):
            twitch.get_live_streams(first=999)
        self.assertEqual(captured.get("first"), ["50"])


@override_settings(**TEST_SETTINGS)
class TwitchCategoryMappingTests(TestCase):
    def setUp(self):
        cache.clear()

    @staticmethod
    def _routes(games_handler):
        return [
            (_is_token, lambda req: _json_response(TOKEN_BODY)),
            (_is_games, games_handler),
            (_is_streams, lambda req: _json_response({"data": []})),
        ]

    def test_persisted_id_skips_upstream(self):
        game = Game.objects.create(name="VALORANT", twitch_category_id=510913)
        fake = _make_urlopen(self._routes(lambda req: _never(req)))
        with patch_urlopen(fake):
            category = twitch.get_game_category(game)
        self.assertEqual(category["id"], 510913)
        self.assertEqual(fake.calls, [])

    def test_maps_by_igdb_id_and_persists(self):
        game = Game.objects.create(name="VALORANT", igdb_id=10235)

        def games_handler(req):
            query = _query(req)
            if query.get("igdb_id") == ["10235"]:
                return _json_response({"data": [{"id": 510913, "name": "VALORANT"}]})
            return _json_response({"data": []})

        fake = _make_urlopen(self._routes(games_handler))
        with patch_urlopen(fake):
            category = twitch.get_game_category(game)
        self.assertEqual(category, {"id": 510913, "name": "VALORANT"})
        game.refresh_from_db()
        self.assertEqual(game.twitch_category_id, 510913)
        self.assertEqual(game.twitch_category_name, "VALORANT")
        # Second resolution uses the persisted id — zero upstream traffic.
        with patch_urlopen(_make_urlopen(self._routes(lambda req: _never(req)))):
            again = twitch.get_game_category(game)
        self.assertEqual(again["id"], 510913)

    def test_maps_by_exact_name_when_no_igdb_id(self):
        game = Game.objects.create(name="Counter-Strike 2")

        def games_handler(req):
            query = _query(req)
            if query.get("name") == ["Counter-Strike 2"]:
                return _json_response({"data": [{"id": 566091, "name": "Counter-Strike 2"}]})
            return _json_response({"data": []})

        with patch_urlopen(_make_urlopen(self._routes(games_handler))):
            category = twitch.get_game_category(game)
        self.assertEqual(category["id"], 566091)

    def test_normalized_name_fallback_strips_symbols(self):
        game = Game.objects.create(name="EA SPORTS FC\u2122 25")

        def games_handler(req):
            query = _query(req)
            name = (query.get("name") or [""])[0]
            if name == "EA SPORTS FC\u2122 25":
                return _json_response({"data": []})  # exact attempt misses
            if name == "EA SPORTS FC 25":
                return _json_response({"data": [{"id": 248215, "name": "EA SPORTS FC 25"}]})
            return _json_response({"data": []})

        with patch_urlopen(_make_urlopen(self._routes(games_handler))):
            category = twitch.get_game_category(game)
        self.assertEqual(category["id"], 248215)

    def test_no_match_returns_none_and_is_negatively_cached(self):
        game = Game.objects.create(name="Totally Unknown Indie Game")
        hits = {"count": 0}

        def games_handler(req):
            hits["count"] += 1
            return _json_response({"data": []})

        fake = _make_urlopen(self._routes(games_handler))
        with patch_urlopen(fake):
            first = twitch.get_game_category(game)
            second = twitch.get_game_category(game)
        self.assertIsNone(first)
        self.assertIsNone(second)
        self.assertEqual(hits["count"], 1)

    def test_upstream_error_during_mapping_returns_none(self):
        game = Game.objects.create(name="VALORANT", igdb_id=10235)
        fake = self._routes(lambda req: _http_error(req.full_url, 500))
        with patch_urlopen(_make_urlopen(fake)):
            self.assertIsNone(twitch.get_game_category(game))

    def test_live_streams_empty_when_game_unmapped(self):
        game = Game.objects.create(name="Totally Unknown Indie Game")
        fake = self._routes(lambda req: _json_response({"data": []}))
        with patch_urlopen(_make_urlopen(fake)):
            self.assertEqual(twitch.get_live_streams(game=game), [])


def _global_routes(stream_records=None, category_id=510913):
    records = STREAM_RECORDS if stream_records is None else stream_records

    def games_handler(req):
        query = _query(req)
        if query.get("igdb_id") == ["10235"]:
            return _json_response({"data": [{"id": category_id, "name": "VALORANT"}]})
        return _json_response({"data": []})

    return [
        (_is_token, lambda req: _json_response(TOKEN_BODY)),
        (_is_streams, lambda req: _json_response({"data": records})),
        (_is_games, games_handler),
    ]


@override_settings(**TEST_SETTINGS)
class TwitchApiViewTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_global_available_false_without_credentials(self):
        with override_settings(
            TWITCH_CLIENT_ID="",
            TWITCH_CLIENT_SECRET="",
            TWITCH_DISABLE_IGDB_FALLBACK=True,
        ):
            with patch_urlopen(_never):
                response = self.client.get(reverse("api_live"))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload["available"])
        self.assertEqual(payload["streams"], [])
        self.assertEqual(payload["games"], [])

    def test_global_streams_normalized_and_grouped_by_ggz_game(self):
        Game.objects.create(name="VALORANT", igdb_id=10235, popularity=50)
        with patch_urlopen(_make_urlopen(_global_routes())):
            response = self.client.get(reverse("api_live"))
        payload = response.json()
        self.assertTrue(payload["available"])
        self.assertEqual(len(payload["streams"]), 2)
        self.assertEqual(payload["streams"][0]["broadcaster_login"], "hararehero")
        valorant_stream = next(s for s in payload["streams"] if s["game_id"] == "510913")
        self.assertEqual(valorant_stream["ggz_game_name"], "VALORANT")
        self.assertTrue(payload["games"])
        self.assertEqual(payload["games"][0]["name"], "VALORANT")
        self.assertEqual(payload["games"][0]["stream_count"], 1)

    def test_global_degrades_to_usable_empty_when_twitch_errors(self):
        routes = [
            (_is_token, lambda req: _json_response(TOKEN_BODY)),
            (_is_streams, lambda req: _http_error(req.full_url, 503)),
        ]
        with patch_urlopen(_make_urlopen(routes)):
            response = self.client.get(reverse("api_live"))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["available"])
        self.assertEqual(payload["streams"], [])
        self.assertEqual(payload["games"], [])

    def test_game_mode_returns_streams_for_matching_game(self):
        game = Game.objects.create(name="VALORANT", igdb_id=10235, twitch_category_id=510913)
        with patch_urlopen(_make_urlopen(_global_routes())):
            response = self.client.get(reverse("api_live"), {"game": game.id})
        payload = response.json()
        self.assertEqual(payload["mode"], "game")
        self.assertEqual(payload["game"]["id"], game.id)
        self.assertEqual(payload["game"]["name"], "VALORANT")
        # game_id=510913 stream matches the persisted category filter
        routes = _global_routes()
        with patch_urlopen(_make_urlopen(routes)):
            response = self.client.get(reverse("api_live"), {"game": game.id})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["available"])

    def test_game_mode_404_for_unknown_or_invalid_game(self):
        self.assertEqual(self.client.get(reverse("api_live"), {"game": 999999}).status_code, 404)
        self.assertEqual(self.client.get(reverse("api_live"), {"game": "abc"}).status_code, 404)

    def test_channel_mode_returns_single_broadcaster(self):
        def routes(req):
            if _is_token(req):
                return _json_response(TOKEN_BODY)
            if _is_streams(req) and _query(req).get("user_login") == ["hararehero"]:
                return _json_response({"data": [STREAM_RECORDS[0]]})
            if _is_streams(req):
                return _json_response({"data": []})
            return _json_response({"data": []})

        with patch_urlopen(_make_urlopen([(lambda req: True, routes)])):
            response = self.client.get(reverse("api_live"), {"channel": "hararehero"})
        payload = response.json()
        self.assertEqual(payload["mode"], "channel")
        self.assertEqual(len(payload["streams"]), 1)
        self.assertEqual(payload["streams"][0]["broadcaster_login"], "hararehero")

    def test_language_param_reflected_in_global_mode(self):
        with patch_urlopen(_make_urlopen(_global_routes())):
            response = self.client.get(reverse("api_live"), {"language": "en"})
        self.assertEqual(response.json()["language"], "en")

    def test_secrets_and_tokens_never_appear_in_any_mode(self):
        Game.objects.create(name="VALORANT", igdb_id=10235, twitch_category_id=510913)
        forbidden = ("test-twitch-secret", "test-twitch-client", "test-access-token")
        with patch_urlopen(_make_urlopen(_global_routes())):
            for params in ({}, {"channel": "hararehero"}, {"game": "1"}):
                response = self.client.get(reverse("api_live"), params)
                content = response.content.decode("utf-8")
                for secret in forbidden:
                    self.assertNotIn(secret, content)

    def test_post_not_allowed(self):
        self.assertEqual(self.client.post(reverse("api_live")).status_code, 405)
