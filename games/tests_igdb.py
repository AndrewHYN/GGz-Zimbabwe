import json
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse

from accounts.models import GamerProfile

from .models import Game
from .services import igdb as service

CONFIGURED = {"IGDB_CLIENT_ID": "test-client-id", "IGDB_CLIENT_SECRET": "test-client-secret"}

IGDB_RECORD = {
    "id": 10235,
    "name": "Valorant",
    "slug": "valorant",
    "url": "https://www.igdb.com/games/valorant",
    "summary": "A 5v5 character-based tactical FPS where precise gunplay meets unique agent abilities.",
    "first_release_date": 1590624000,
    "rating": 87.5,
    "rating_count": 1250,
    "aggregated_rating": 85.2,
    "cover": {"url": "//images.igdb.com/igdb/image/upload/t_thumb/v123.jpg"},
    "genres": [{"name": "Shooter"}, {"name": "Tactical"}],
    "platforms": [{"name": "PC"}],
    "screenshots": [{"url": "//images.igdb.com/igdb/image/upload/t_thumb/s1.jpg"}],
    "similar_games": [9001, 9002],
}

IGDB_COMPANIES = [
    {"company": {"name": "Riot Games"}, "developer": True, "publisher": True},
]


def _external(**overrides):
    payload = {
        "igdb_id": 10235,
        "name": "Valorant",
        "slug": "valorant",
        "igdb_url": "https://www.igdb.com/games/valorant",
        "cover_url": "https://images.igdb.com/igdb/image/upload/t_cover_big/v123.jpg",
        "summary": "A 5v5 character-based tactical FPS.",
        "genres": "Shooter, Tactical",
        "platforms": "PC",
        "rating": 87.5,
        "rating_count": 1250,
        "release_date": "2020-05-28",
        "release_year": 2020,
        "screenshots": ["https://images.igdb.com/igdb/image/upload/t_screenshot_big/s1.jpg"],
        "developers": "Riot Games",
        "publishers": "Riot Games",
    }
    payload.update(overrides)
    return payload


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload if isinstance(payload, bytes) else str(payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return self._payload


class IGDBServiceTests(TestCase):
    def setUp(self):
        cache.clear()

    @override_settings(**CONFIGURED)
    def test_is_configured_reflects_credentials(self):
        self.assertTrue(service.is_configured())

    @override_settings(**CONFIGURED)
    def test_is_configured_false_when_credentials_missing(self):
        with override_settings(IGDB_CLIENT_ID="", IGDB_CLIENT_SECRET=""):
            self.assertFalse(service.is_configured())

    @override_settings(**CONFIGURED)
    def test_access_token_is_obtained_once_then_reused_from_cache(self):
        token = json.dumps({"access_token": "abc123", "expires_in": 3600})
        with patch.object(service, "urlopen", return_value=FakeResponse(token)) as mock_open:
            self.assertEqual(service._get_access_token(), "abc123")
            self.assertEqual(service._get_access_token(), "abc123")
            self.assertEqual(mock_open.call_count, 1)

    @override_settings(**CONFIGURED)
    def test_search_returns_normalized_catalogue_results(self):
        with (
            patch.object(service, "_post_query", return_value=[IGDB_RECORD]) as mock_post,
            patch.object(service, "_get_access_token", return_value="test-token"),
        ):
            results = service.search_games("valorant")

        self.assertEqual(len(results), 1)
        result = results[0]
        self.assertEqual(result["igdb_id"], 10235)
        self.assertEqual(result["name"], "Valorant")
        self.assertEqual(result["genres"], "Shooter, Tactical")
        self.assertEqual(result["platforms"], "PC")
        self.assertEqual(result["rating"], 87.5)
        self.assertEqual(result["release_year"], 2020)
        self.assertEqual(result["release_date"], "2020-05-28")
        self.assertTrue(result["cover_url"].startswith("https://images.igdb.com"))
        self.assertIn("/t_cover_big/", result["cover_url"])
        mock_post.assert_called_once_with('search "valorant"; fields %s; limit 8;' % service._GAME_FIELDS, endpoint="games")

    @override_settings(**CONFIGURED)
    def test_get_game_returns_full_metadata_with_companies_and_screenshots(self):
        def fake_post(query, endpoint="games"):
            if endpoint == "involved_companies":
                return IGDB_COMPANIES
            return [IGDB_RECORD]

        with (
            patch.object(service, "_post_query", side_effect=fake_post),
            patch.object(service, "_get_access_token", return_value="test-token"),
        ):
            result = service.get_game(10235)

        self.assertIsNotNone(result)
        self.assertEqual(result["developers"], "Riot Games")
        self.assertEqual(result["publishers"], "Riot Games")
        self.assertEqual(result["screenshots"], ["https://images.igdb.com/igdb/image/upload/t_screenshot_big/s1.jpg"])

    @override_settings(**CONFIGURED)
    def test_search_returns_empty_list_when_igdb_not_configured(self):
        with override_settings(IGDB_CLIENT_ID="", IGDB_CLIENT_SECRET=""):
            with patch.object(service, "urlopen", side_effect=AssertionError("must not call network")):
                self.assertEqual(service.search_games("valorant"), [])

    @override_settings(**CONFIGURED)
    def test_search_returns_empty_list_when_api_times_out(self):
        with patch.object(service, "urlopen", side_effect=TimeoutError("timed out")):
            self.assertEqual(service.search_games("valorant"), [])

    @override_settings(**CONFIGURED)
    def test_search_returns_empty_list_when_api_rate_limited(self):
        with patch.object(service, "_post_query", side_effect=service.IGDBRateLimitedError("throttled")):
            self.assertEqual(service.search_games("valorant"), [])

    @override_settings(**CONFIGURED)
    def test_get_game_returns_none_when_api_fails(self):
        with patch.object(service, "_post_query", side_effect=service.IGDBUnavailableError("down")):
            self.assertIsNone(service.get_game(10235))

    @override_settings(**CONFIGURED)
    def test_malformed_records_do_not_crash(self):
        with (
            patch.object(service, "_post_query", return_value=[{"id": 1}]),
            patch.object(service, "_get_access_token", return_value="test-token"),
        ):
            results = service.search_games("mystery")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Game 1")
        self.assertEqual(results[0]["cover_url"], "")

    @override_settings(**CONFIGURED)
    def test_search_results_are_cached(self):
        with (
            patch.object(service, "_post_query", return_value=[IGDB_RECORD]) as mock_post,
            patch.object(service, "_get_access_token", return_value="test-token"),
        ):
            first = service.search_games("valorant")
            second = service.search_games("valorant")
        self.assertEqual(first, second)
        self.assertEqual(mock_post.call_count, 1)

    @override_settings(**CONFIGURED)
    def test_get_game_cache_miss_only_hits_api_on_first_load(self):
        with (
            patch.object(service, "_post_query", return_value=[IGDB_RECORD]) as mock_post,
            patch.object(service, "_get_access_token", return_value="test-token"),
        ):
            service.get_game(10235)
            first_count = mock_post.call_count
            cache.delete("igdb:game:10235")
            service.get_game(10235)
        self.assertGreater(mock_post.call_count, first_count)

    @override_settings(**CONFIGURED)
    def test_import_creates_local_game_and_dedupes_by_igdb_id(self):
        with (
            patch.object(service, "get_game", return_value=_external()),
            patch.object(service, "get_related_games", return_value=[]),
        ):
            first = service.import_game(10235)
            second = service.import_game(10235)

        self.assertEqual(Game.objects.count(), 1)
        self.assertEqual(first.id, second.id)
        self.assertEqual(first.igdb_id, 10235)
        self.assertEqual(first.name, "Valorant")
        self.assertEqual(first.genre, "Shooter")
        self.assertEqual(first.platform, "PC")
        self.assertEqual(first.developer, "Riot Games")
        self.assertEqual(first.igdb_rating, Decimal("87.5"))
        self.assertEqual(first.igdb_release_date, date(2020, 5, 28))
        self.assertTrue(first.cover_art_url.startswith("https://images.igdb.com"))
        self.assertTrue(first.description.startswith("A 5v5 character-based tactical FPS."))
        self.assertIsNotNone(first.igdb_last_synced)

    @override_settings(**CONFIGURED)
    def test_import_updates_existing_game_by_name(self):
        existing = Game.objects.create(name="Valorant")
        with (
            patch.object(service, "get_game", return_value=_external()),
            patch.object(service, "get_related_games", return_value=[]),
        ):
            imported = service.import_game(10235)

        self.assertEqual(imported.id, existing.id)
        self.assertEqual(imported.igdb_id, 10235)
        self.assertEqual(Game.objects.count(), 1)

    @override_settings(**CONFIGURED)
    def test_sync_preserves_curated_fields_and_stamps_last_synced(self):
        game = Game.objects.create(name="Valorant", igdb_id=10235, description="Curated local pick.")
        with patch.object(service, "get_game", return_value=_external()):
            result = service.sync_game(game)

        self.assertEqual(result.description, "Curated local pick.")
        self.assertEqual(result.genre, "Shooter")
        self.assertEqual(result.igdb_rating, Decimal("87.5"))
        self.assertIsNotNone(result.igdb_last_synced)


class IGDBViewTests(TestCase):
    def setUp(self):
        cache.clear()

    def _login(self):
        user = User.objects.create_user(username="importer", password="pass-12345")
        GamerProfile.objects.create(user=user, gamer_tag="ImporterZW")
        self.client.force_login(user)
        return user

    @override_settings(**CONFIGURED)
    def test_game_list_shows_catalogue_results_when_searching(self):
        self._login()
        result = _external()
        result["cover_url"] = ""
        with patch("games.views.search_games", return_value=[result]):
            response = self.client.get(reverse("game_list"), {"q": "valorant"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "More from the catalogue")
        self.assertContains(response, "Valorant")
        self.assertContains(response, "Add to GGz")

    @override_settings(**CONFIGURED)
    def test_game_list_does_not_hit_igdb_without_query(self):
        with patch("games.views.search_games", side_effect=AssertionError("should not call IGDB")):
            response = self.client.get(reverse("game_list"))
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "More from the catalogue")

    @override_settings(**CONFIGURED)
    def test_game_list_degrades_when_igdb_search_fails(self):
        with patch("games.views.search_games", return_value=[]):
            response = self.client.get(reverse("game_list"), {"q": "valorant"})
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "More from the catalogue")

    @override_settings(**CONFIGURED)
    def test_game_import_creates_game_and_redirects_back_to_search(self):
        self._login()
        created = Game.objects.create(name="Valorant", igdb_id=10235)
        with patch("games.views.import_game", return_value=created):
            response = self.client.post(reverse("game_import", args=[10235]), {"q": "valorant"})
        self.assertRedirects(response, "/games/?q=valorant")

    @override_settings(**CONFIGURED)
    def test_game_import_requires_login(self):
        response = self.client.post(reverse("game_import", args=[10235]))
        self.assertEqual(response.status_code, 302)
        self.assertIn("login", response.url)

    @override_settings(**CONFIGURED)
    def test_game_import_failure_shows_message_and_stays_on_list(self):
        self._login()
        with patch("games.views.import_game", return_value=None):
            response = self.client.post(reverse("game_import", args=[10235]), {"q": "valorant"})
        self.assertRedirects(response, "/games/")

    @override_settings(**CONFIGURED)
    def test_game_detail_renders_catalogue_panel_when_igdb_meta_present(self):
        game = Game.objects.create(
            name="Valorant",
            igdb_id=10235,
            igdb_rating=Decimal("87.5"),
            igdb_genres="Shooter, Tactical",
            igdb_summary="A 5v5 character-based tactical FPS.",
            igdb_url="https://www.igdb.com/games/valorant",
        )
        with (
            patch("games.views.get_game", return_value={"screenshots": ["https://images.igdb.com/x.jpg"]}),
            patch(
                "games.views.get_related_games",
                return_value=[{"igdb_id": 9001, "name": "Counter-Strike 2", "igdb_url": "https://www.igdb.com/games/counter-strike-2", "local_id": None}],
            ),
        ):
            response = self.client.get(reverse("game_detail", args=[game.id]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "From the catalogue")
        self.assertContains(response, "Catalogue rating")
        self.assertContains(response, "88 / 100")
        self.assertContains(response, "Genres")
        self.assertContains(response, "Counter-Strike 2")
        self.assertContains(response, "IGDB/Twitch API")

    @override_settings(**CONFIGURED)
    def test_game_detail_without_igdb_id_does_not_call_service(self):
        game = Game.objects.create(name="Valorant")
        with (
            patch("games.views.get_game", side_effect=AssertionError("should not call IGDB")),
            patch("games.views.get_related_games", side_effect=AssertionError("should not call IGDB")),
        ):
            response = self.client.get(reverse("game_detail", args=[game.id]))
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "From the catalogue")