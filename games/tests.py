from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from accounts.models import GamerProfile, Notification, Post
from django.contrib.auth.models import User
from tournaments.models import Challenge, Tournament, TournamentMatch
from events.models import Event

from .models import Game, GameReview, GameWishlist


class GameHubTests(TestCase):
	def test_game_list_is_alphabetical(self):
		Game.objects.create(name="Valorant")
		Game.objects.create(name="Apex Legends")

		response = self.client.get(reverse("game_list"))

		self.assertContains(response, "Apex Legends")
		self.assertContains(response, "Valorant")
		self.assertLess(
			response.content.index(b"Apex Legends"),
			response.content.index(b"Valorant"),
		)

	def test_game_detail_displays_metadata(self):
		game = Game.objects.create(
			name="EA FC",
			player_count=22,
			popularity=80,
			release_year=2025,
		)

		response = self.client.get(reverse("game_detail", args=[game.id]))

		self.assertContains(response, "2025")
		self.assertContains(response, "22")

	def test_game_detail_renders_real_youtube_trailer_for_mortal_kombat(self):
		game = Game.objects.create(
			name="Mortal Kombat",
			trailer_url="https://www.youtube.com/watch?v=V5uCZuKtyr0",
		)

		response = self.client.get(reverse("game_detail", args=[game.id]))

		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "GAMEPLAY TRAILER")
		self.assertContains(response, "https://www.youtube.com/embed/V5uCZuKtyr0")
		self.assertContains(response, 'title="Mortal Kombat official trailer"')

	def test_game_detail_shows_only_related_posts(self):
		user = User.objects.create_user(username="gamer")
		profile = GamerProfile.objects.create(user=user, gamer_tag="GamerZW")
		game = Game.objects.create(name="Tekken 8")
		other_game = Game.objects.create(name="Street Fighter 6")
		Post.objects.create(author=profile, game=game, body="Tekken community post")
		Post.objects.create(author=profile, game=other_game, body="Street Fighter post")

		response = self.client.get(reverse("game_detail", args=[game.id]))

		self.assertContains(response, "Tekken community post")
		self.assertNotContains(response, "Street Fighter post")

	def test_game_detail_has_compact_trailer_with_game_community_preview(self):
		game = Game.objects.create(name="Mortal Kombat", trailer_url="https://www.youtube.com/watch?v=V5uCZuKtyr0")
		user = User.objects.create_user(username="mkplayer")
		profile = GamerProfile.objects.create(user=user, gamer_tag="MKPlayerZW")
		Post.objects.create(author=profile, game=game, body="Finally hit Master 🔥")

		response = self.client.get(reverse("game_detail", args=[game.id]))

		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "VIEW ALL COMMUNITY POSTS")
		self.assertContains(response, "game-community-panel")
		self.assertContains(response, "Finally hit Master 🔥")

	def test_game_leaderboard_shows_competitive_rankings(self):
		game = Game.objects.create(name="Valorant")
		organizer_user = User.objects.create_user(username="organizer", password="pass")
		organizer = GamerProfile.objects.create(user=organizer_user, gamer_tag="OrganizerZW")

		player1_user = User.objects.create_user(username="player1", password="pass")
		player1 = GamerProfile.objects.create(user=player1_user, gamer_tag="Player1ZW")
		player1.games.add(game)

		player2_user = User.objects.create_user(username="player2", password="pass")
		player2 = GamerProfile.objects.create(user=player2_user, gamer_tag="Player2ZW")
		player2.games.add(game)

		tournament = Tournament.objects.create(
			organizer=organizer,
			game=game,
			name="Valorant Championship",
			slug="valorant-championship",
			description="Test tournament",
			format="1v1",
			start_date="2026-12-15T18:00:00Z",
			registration_deadline="2026-12-14T18:00:00Z",
			status="Completed"
		)

		# Player 1 wins 2 matches, Player 2 wins 1
		TournamentMatch.objects.create(
			tournament=tournament, game=game, player_one=player1, player_two=player2, winner=player1, status="Completed"
		)
		TournamentMatch.objects.create(
			tournament=tournament, game=game, player_one=player1, player_two=player2, winner=player1, status="Completed"
		)
		TournamentMatch.objects.create(
			tournament=tournament, game=game, player_one=player1, player_two=player2, winner=player2, status="Completed"
		)

		response = self.client.get(reverse("game_leaderboard", args=[game.id]))

		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Player1ZW")
		self.assertContains(response, "Player2ZW")
		# Player 1 should appear before Player 2 in the leaderboard
		self.assertLess(
			response.content.index(b"Player1ZW"),
			response.content.index(b"Player2ZW"),
		)

	def test_game_detail_shows_leaderboard_top_10(self):
		game = Game.objects.create(name="Tekken 8")
		organizer_user = User.objects.create_user(username="org", password="pass")
		organizer = GamerProfile.objects.create(user=organizer_user, gamer_tag="OrgZW")

		tournament = Tournament.objects.create(
			organizer=organizer,
			game=game,
			name="Tournament",
			slug="tournament",
			description="Test",
			format="1v1",
			start_date="2026-12-15T18:00:00Z",
			registration_deadline="2026-12-14T18:00:00Z",
			status="Completed"
		)

		player_user = User.objects.create_user(username="p", password="pass")
		player = GamerProfile.objects.create(user=player_user, gamer_tag="PlayerZW")
		player.games.add(game)

		opponent_user = User.objects.create_user(username="opp", password="pass")
		opponent = GamerProfile.objects.create(user=opponent_user, gamer_tag="OpponentZW")

		TournamentMatch.objects.create(
			tournament=tournament, game=game, player_one=player, player_two=opponent, winner=player, status="Completed"
		)

		response = self.client.get(reverse("game_detail", args=[game.id]))

		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Top Tekken 8 players")
		self.assertContains(response, "PlayerZW")

	def test_leaderboard_only_counts_completed_matches(self):
		"""Wins should only be counted from Completed matches, not Scheduled/Live/Cancelled."""
		game = Game.objects.create(name="Street Fighter 6")
		organizer_user = User.objects.create_user(username="organizer", password="pass")
		organizer = GamerProfile.objects.create(user=organizer_user, gamer_tag="OrgZW")

		player_user = User.objects.create_user(username="player", password="pass")
		player = GamerProfile.objects.create(user=player_user, gamer_tag="PlayerZW")
		player.games.add(game)

		opponent_user = User.objects.create_user(username="opponent", password="pass")
		opponent = GamerProfile.objects.create(user=opponent_user, gamer_tag="OpponentZW")

		tournament = Tournament.objects.create(
			organizer=organizer, game=game, name="Test", slug="test",
			description="Test", format="1v1", start_date="2026-12-15T18:00:00Z",
			registration_deadline="2026-12-14T18:00:00Z", status="Active"
		)

		# Create matches with different statuses - only Completed should count
		TournamentMatch.objects.create(
			tournament=tournament, game=game, player_one=player, player_two=opponent,
			winner=player, status="Completed"
		)
		TournamentMatch.objects.create(
			tournament=tournament, game=game, player_one=player, player_two=opponent,
			winner=player, status="Scheduled"  # Should NOT count
		)
		TournamentMatch.objects.create(
			tournament=tournament, game=game, player_one=player, player_two=opponent,
			winner=player, status="Live"  # Should NOT count
		)
		TournamentMatch.objects.create(
			tournament=tournament, game=game, player_one=player, player_two=opponent,
			winner=player, status="Cancelled"  # Should NOT count
		)

		from games.views import _compute_game_stats
		stats = _compute_game_stats(game)

		# Player should have 1 win (only the Completed match)
		self.assertEqual(len(stats), 1)
		player_stat, wins, matches, win_rate = stats[0]
		self.assertEqual(player_stat.id, player.id)
		self.assertEqual(wins, 1)
		self.assertEqual(matches, 1)
		self.assertEqual(win_rate, 100.0)

	def test_leaderboard_validates_winner_participation(self):
		"""Wins should only count if the winner was actually a participant in the match."""
		game = Game.objects.create(name="Mortal Kombat")
		organizer_user = User.objects.create_user(username="organizer", password="pass")
		organizer = GamerProfile.objects.create(user=organizer_user, gamer_tag="OrgZW")

		player1_user = User.objects.create_user(username="player1", password="pass")
		player1 = GamerProfile.objects.create(user=player1_user, gamer_tag="Player1ZW")
		player1.games.add(game)

		player2_user = User.objects.create_user(username="player2", password="pass")
		player2 = GamerProfile.objects.create(user=player2_user, gamer_tag="Player2ZW")

		other_user = User.objects.create_user(username="other", password="pass")
		other = GamerProfile.objects.create(user=other_user, gamer_tag="OtherZW")

		tournament = Tournament.objects.create(
			organizer=organizer, game=game, name="Test", slug="test",
			description="Test", format="1v1", start_date="2026-12-15T18:00:00Z",
			registration_deadline="2026-12-14T18:00:00Z", status="Completed"
		)

		# Create match where player1 and player2 compete, but we incorrectly mark other as winner
		TournamentMatch.objects.create(
			tournament=tournament, game=game, player_one=player1, player_two=player2,
			winner=other, status="Completed"  # Other is winner but not a participant!
		)

		from games.views import _compute_game_stats
		stats = _compute_game_stats(game)

		# Should have no leaderboard entries (other didn't play any games)
		self.assertEqual(len(stats), 0)

	def test_leaderboard_excludes_players_with_no_matches(self):
		"""Players who haven't played any completed matches should not appear on leaderboard."""
		game = Game.objects.create(name="Tekken 8")
		user1 = User.objects.create_user(username="active", password="pass")
		profile1 = GamerProfile.objects.create(user=user1, gamer_tag="ActiveZW")
		profile1.games.add(game)

		user2 = User.objects.create_user(username="inactive", password="pass")
		profile2 = GamerProfile.objects.create(user=user2, gamer_tag="InactiveZW")
		profile2.games.add(game)

		organizer_user = User.objects.create_user(username="org", password="pass")
		organizer = GamerProfile.objects.create(user=organizer_user, gamer_tag="OrgZW")

		tournament = Tournament.objects.create(
			organizer=organizer, game=game, name="Test", slug="test",
			description="Test", format="1v1", start_date="2026-12-15T18:00:00Z",
			registration_deadline="2026-12-14T18:00:00Z", status="Completed"
		)

		# Only create a match for profile1
		TournamentMatch.objects.create(
			tournament=tournament, game=game, player_one=profile1, player_two=organizer,
			winner=profile1, status="Completed"
		)

		from games.views import _compute_game_stats
		stats = _compute_game_stats(game)

		# Only profile1 should appear (profile2 has 0 matches)
		self.assertEqual(len(stats), 1)
		self.assertEqual(stats[0][0].id, profile1.id)

	def test_leaderboard_prefers_larger_sample_when_wins_tie(self):
		"""A larger competitive sample should outrank an identical win total with a tiny sample."""
		game = Game.objects.create(name="Street Fighter 6")
		organizer_user = User.objects.create_user(username="organizer2", password="pass")
		organizer = GamerProfile.objects.create(user=organizer_user, gamer_tag="Org2ZW")
		player_a_user = User.objects.create_user(username="tiny-sample", password="pass")
		player_a = GamerProfile.objects.create(user=player_a_user, gamer_tag="TinySampleZW")
		player_a.games.add(game)
		player_b_user = User.objects.create_user(username="bigger-sample", password="pass")
		player_b = GamerProfile.objects.create(user=player_b_user, gamer_tag="BiggerSampleZW")
		player_b.games.add(game)
		tournament = Tournament.objects.create(
			organizer=organizer, game=game, name="Sample Test", slug="sample-test",
			description="Test", format="1v1", start_date="2026-12-15T18:00:00Z",
			registration_deadline="2026-12-14T18:00:00Z", status="Completed"
		)

		# Player A: 1 win in 1 match
		TournamentMatch.objects.create(
			tournament=tournament, game=game, player_one=player_a, player_two=player_b,
			winner=player_a, status="Completed"
		)
		# Player B: 1 win in 5 matches, so B outranks A despite the same win total.
		for winner in (player_b, player_b, player_b, player_b, player_b):
			TournamentMatch.objects.create(
				tournament=tournament, game=game, player_one=player_b, player_two=player_a,
				winner=winner, status="Completed"
			)

		from games.views import _compute_game_stats
		stats = _compute_game_stats(game)
		self.assertEqual(stats[0][0].id, player_b.id)
		self.assertEqual(stats[1][0].id, player_a.id)

	def test_game_storefront_displays_featured_free_and_local_sections(self):
		game = Game.objects.create(
			name="Valorant",
			genre="FPS",
			developer="Riot Games",
			cover_art_url="https://example.com/valorant.jpg",
			free_to_play=True,
			featured=True,
			local_developer=False,
			sponsored=False,
			store_url="https://store.epicgames.com/p/valorant",
		)
		response = self.client.get(reverse("game_list"))

		self.assertContains(response, "Featured")
		self.assertContains(response, "FREE TO PLAY")
		self.assertContains(response, "Popular Games")
		self.assertContains(response, str(game.name))
		self.assertContains(response, "https://store.epicgames.com/p/valorant")

	def test_game_detail_renders_store_cta_and_safe_youtube_embed(self):
		game = Game.objects.create(
			name="Counter-Strike 2",
			genre="Shooter",
			developer="Valve",
			cover_art_url="https://example.com/cs2.jpg",
			store_url="https://store.steampowered.com/app/730/",
			trailer_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			free_to_play=False,
		)

		response = self.client.get(reverse("game_detail", args=[game.id]))

		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Buy on Steam")
		self.assertContains(response, "https://store.steampowered.com/app/730/")
		self.assertContains(response, "https://www.youtube.com/embed/dQw4w9WgXcQ")
		self.assertNotContains(response, "javascript:")

	def test_game_detail_missing_trailer_does_not_render_broken_player(self):
		game = Game.objects.create(name="Dota 2", genre="MOBA", free_to_play=True)

		response = self.client.get(reverse("game_detail", args=[game.id]))

		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Play Free")
		self.assertNotContains(response, "youtube.com/embed/")

	def test_game_detail_supports_steam_and_epic_store_links(self):
		game = Game.objects.create(
			name="Fortnite",
			genre="Battle Royale",
			steam_url="https://store.steampowered.com/app/578080/PLAYERUNKNOWNS_BATTLEGROUNDS/",
			epic_url="https://store.epicgames.com/en-US/p/fortnite",
			free_to_play=True,
		)

		response = self.client.get(reverse("game_detail", args=[game.id]))

		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "BUY ON STEAM")
		self.assertContains(response, "BUY ON EPIC")
		self.assertContains(response, "https://store.steampowered.com/app/578080/PLAYERUNKNOWNS_BATTLEGROUNDS/")
		self.assertContains(response, "https://store.epicgames.com/en-US/p/fortnite")

	def test_game_trailer_embed_supports_youtube_shorts_and_rejects_unsafe_urls(self):
		game = Game.objects.create(
			name="Shorts Test",
			trailer_url="https://www.youtube.com/shorts/abcd1234xyz9",
		)
		self.assertEqual(game.trailer_embed_url, "https://www.youtube.com/embed/abcd1234xyz9")
		self.assertEqual(Game(name="Unsafe", trailer_url="https://example.com/video").trailer_embed_url, "")

	def test_game_list_supports_platform_and_featured_filtering(self):
		Game.objects.create(name="Apex Legends", genre="Battle Royale", platform="PC", popularity=90, featured=True, free_to_play=False)
		Game.objects.create(name="Fortnite", genre="Battle Royale", platform="PC", popularity=85, featured=False, free_to_play=True)
		Game.objects.create(name="Tekken 8", genre="Fighting", platform="PlayStation 5", popularity=70, featured=False, free_to_play=False)

		response = self.client.get(reverse("game_list"), {"platform": "PC", "featured": "1"})
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Apex Legends")
		self.assertNotContains(response, "Fortnite")
		self.assertNotContains(response, "Tekken 8")

	def test_game_ui_css_keeps_cards_and_back_links_compact(self):
		css_path = Path(settings.BASE_DIR) / "hello_world" / "static" / "main.css"
		css = css_path.read_text()
		self.assertIn(".back-link", css)
		self.assertIn("width: fit-content", css)
		self.assertIn("object-fit: cover", css)
		self.assertIn("background-color: rgba(13, 18, 23, 0.9)", css)

	def test_game_review_and_wishlist_flow_works(self):
		game = Game.objects.create(name="Elden Ring", genre="Action RPG")
		player_user = User.objects.create_user(username="reviewerone", password="pass")
		player = GamerProfile.objects.create(user=player_user, gamer_tag="ReviewerOneZW")

		self.client.force_login(player_user)
		response = self.client.post(reverse("game_review_create", args=[game.id]), {"rating": 5, "review": "Excellent adventure."})
		self.assertEqual(response.status_code, 302)
		self.assertTrue(GameReview.objects.filter(game=game, reviewer=player, rating=5, review="Excellent adventure.").exists())

		wishlist_response = self.client.post(reverse("game_wishlist_toggle", args=[game.id]))
		self.assertEqual(wishlist_response.status_code, 302)
		self.assertTrue(GameWishlist.objects.filter(game=game, profile=player).exists())

		self.client.post(reverse("game_wishlist_toggle", args=[game.id]))
		self.assertFalse(GameWishlist.objects.filter(game=game, profile=player).exists())

	def test_game_detail_wires_find_players_and_challenge_friend_to_existing_system(self):
		game = Game.objects.create(name="League of Legends", genre="MOBA")
		player_user = User.objects.create_user(username="playerone", password="pass")
		player = GamerProfile.objects.create(user=player_user, gamer_tag="PlayerOneZW", availability="Available")
		player.games.add(game)
		opponent_user = User.objects.create_user(username="playertwo", password="pass")
		opponent = GamerProfile.objects.create(user=opponent_user, gamer_tag="PlayerTwoZW")
		opponent.games.add(game)

		self.client.force_login(player_user)
		response = self.client.get(reverse("game_detail", args=[game.id]))
		self.assertContains(response, reverse("gamer_discovery") + "?game=" + str(game.id))
		self.assertContains(response, "Challenge a friend")
		self.assertContains(response, "Find players for League of Legends")

		post_response = self.client.post(
			reverse("game_challenge_create", args=[game.id]),
			{"opponent": opponent.id, "scheduled_at": (timezone.now() + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M")},
		)
		self.assertEqual(post_response.status_code, 302)
		self.assertTrue(Challenge.objects.filter(challenger=player, opponent=opponent, game=game).exists())
		self.assertTrue(Notification.objects.filter(recipient=opponent, notification_type="challenge").exists())
		self.assertTrue(self.client.session.get("_auth_user_id"))

		duplicate_response = self.client.post(
			reverse("game_challenge_create", args=[game.id]),
			{"opponent": opponent.id},
		)
		self.assertEqual(duplicate_response.status_code, 302)
		self.assertEqual(Challenge.objects.filter(challenger=player, opponent=opponent, game=game, status="Pending").count(), 1)

	def test_game_challenge_rejects_a_player_outside_the_game(self):
		game = Game.objects.create(name="Valorant", genre="Shooter")
		player_user = User.objects.create_user(username="challenger", password="pass")
		player = GamerProfile.objects.create(user=player_user, gamer_tag="ChallengerZW")
		opponent = GamerProfile.objects.create(user=User.objects.create_user(username="outsider"), gamer_tag="OutsiderZW")
		self.client.force_login(player_user)

		response = self.client.post(reverse("game_challenge_create", args=[game.id]), {"opponent": opponent.id})

		self.assertEqual(response.status_code, 404)
		self.assertFalse(Challenge.objects.exists())
		self.assertEqual(self.client.session.get("_auth_user_id"), str(player_user.id))

	def test_game_detail_surfaces_related_tournaments_and_events(self):
		organizer_user = User.objects.create_user(username="organizer3", password="pass")
		organizer = GamerProfile.objects.create(user=organizer_user, gamer_tag="Organizer3ZW")
		game = Game.objects.create(name="Apex Legends", genre="Battle Royale")
		Tournament.objects.create(
			organizer=organizer,
			game=game,
			name="Apex Weekend Cup",
			slug="apex-weekend-cup",
			description="Testing",
			format="3v3",
			start_date=timezone.now() + timedelta(days=3),
			registration_deadline=timezone.now() + timedelta(days=1),
			status="Registration Open",
		)
		Event.objects.create(
			organizer=organizer,
			game=game,
			name="Harare Apex Scrims",
			description="Testing", 
			start_date=timezone.now() + timedelta(days=2),
			status="Upcoming",
		)

		response = self.client.get(reverse("game_detail", args=[game.id]))
		self.assertContains(response, "Apex Weekend Cup")
		self.assertContains(response, "Harare Apex Scrims")

	def test_find_players_page_keeps_selected_game_context(self):
		game = Game.objects.create(name="Valorant", genre="FPS")
		response = self.client.get(reverse("gamer_discovery"), {"game": game.id})
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Find players for Valorant")
		self.assertContains(response, "Players ready to queue for Valorant")
