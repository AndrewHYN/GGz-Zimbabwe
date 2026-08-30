from django.test import TestCase
from django.urls import reverse

from accounts.models import GamerProfile, Post
from django.contrib.auth.models import User
from tournaments.models import Tournament, TournamentMatch

from .models import Game


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
