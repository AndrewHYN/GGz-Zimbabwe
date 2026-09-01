from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from accounts.models import GamerProfile
from games.models import Game
from teams.models import Team, TeamMembership

from .models import Challenge, Tournament, TournamentMatch, TournamentRegistration


class TournamentTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(username="organizer", password="pass-12345")
		self.organizer = GamerProfile.objects.create(user=self.user, gamer_tag="OrganizerZW")
		self.player_user = User.objects.create_user(username="player", password="pass-12345")
		self.player = GamerProfile.objects.create(user=self.player_user, gamer_tag="PlayerZW")
		self.game = Game.objects.create(name="Valorant")
		now = timezone.now()
		self.tournament = Tournament.objects.create(organizer=self.organizer, game=self.game, name="GGz Cup", slug="ggz-cup", description="A cup", format="1v1", max_participants=1, start_date=now + timedelta(days=2), registration_deadline=now + timedelta(days=1), status="Registration Open")

	def test_tournament_list_and_detail_are_real(self):
		self.assertContains(self.client.get(reverse("tournament_list")), "GGz Cup")
		self.assertContains(self.client.get(reverse("tournament_detail", args=[self.tournament.slug])), "OrganizerZW")

	def test_registration_and_duplicate_prevention(self):
		self.client.login(username="player", password="pass-12345")
		url = reverse("tournament_register", args=[self.tournament.slug])
		self.client.post(url)
		self.client.post(url)
		self.assertEqual(TournamentRegistration.objects.count(), 1)

	def test_team_captain_can_register_full_team_to_tournament(self):
		team_game = Game.objects.create(name="Counter-Strike 2")
		team = Team.objects.create(owner=self.organizer, game=team_game, name="Alpha Squad", tag="AS", slug="alpha-squad")
		TeamMembership.objects.create(team=team, player=self.organizer, role="Captain")
		teammate = GamerProfile.objects.create(user=User.objects.create_user(username="teammate", password="pass-12345"), gamer_tag="MateZW")
		TeamMembership.objects.create(team=team, player=teammate, role="Member")
		tournament = Tournament.objects.create(
			organizer=self.organizer,
			game=team_game,
			name="Team GGz Cup",
			slug="team-ggz-cup",
			description="A team cup",
			format="2v2",
			max_participants=10,
			start_date=timezone.now() + timedelta(days=3),
			registration_deadline=timezone.now() + timedelta(days=2),
			status="Registration Open",
		)
		self.client.login(username="organizer", password="pass-12345")
		response = self.client.post(reverse("tournament_register", args=[tournament.slug]), {"team_id": team.id})
		self.assertEqual(response.status_code, 302)
		self.assertEqual(TournamentRegistration.objects.filter(tournament=tournament).count(), 2)
		self.assertTrue(TournamentRegistration.objects.filter(tournament=tournament, player=self.organizer).exists())
		self.assertTrue(TournamentRegistration.objects.filter(tournament=tournament, player=teammate).exists())

	def test_cancelled_tournament_cannot_be_joined(self):
		self.tournament.status = "Cancelled"
		self.tournament.save(update_fields=("status",))
		self.client.login(username="player", password="pass-12345")
		response = self.client.post(reverse("tournament_register", args=[self.tournament.slug]))
		self.assertEqual(response.status_code, 403)

	def test_registration_after_deadline_is_rejected(self):
		self.tournament.registration_deadline = timezone.now() - timedelta(days=1)
		self.tournament.save(update_fields=("registration_deadline",))
		self.client.login(username="player", password="pass-12345")
		response = self.client.post(reverse("tournament_register", args=[self.tournament.slug]))
		self.assertEqual(response.status_code, 403)

	def test_odd_player_count_generates_bye_in_bracket(self):
		players = [self.player]
		for index in range(2):
			players.append(GamerProfile.objects.create(user=User.objects.create_user(username=f"bye{index}"), gamer_tag=f"Bye{index}ZW"))
		for player in players:
			TournamentRegistration.objects.create(tournament=self.tournament, player=player)
		self.tournament.max_participants = 4
		self.tournament.save(update_fields=("max_participants",))
		self.client.login(username="organizer", password="pass-12345")
		self.client.post(reverse("generate_bracket", args=(self.tournament.slug,)))
		self.assertEqual(self.tournament.matches.count(), 3)
		self.assertTrue(self.tournament.matches.filter(score="Bye").exists())

	def test_match_result_rejects_invalid_score_format(self):
		match = TournamentMatch.objects.create(tournament=self.tournament, game=self.game, player_one=self.player, player_two=self.organizer)
		self.client.login(username="player", password="pass-12345")
		response = self.client.post(reverse("match_result", args=[match.id]), {"winner": self.player.id, "score": "banana", "status": "Completed"})
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Score must use the format")

	def test_final_result_completes_tournament_and_updates_winner_stats(self):
		players = [self.player]
		for index in range(3):
			players.append(GamerProfile.objects.create(user=User.objects.create_user(username=f"final{index}"), gamer_tag=f"Final{index}ZW"))
		for player in players:
			TournamentRegistration.objects.create(tournament=self.tournament, player=player)
		self.tournament.max_participants = 4
		self.tournament.save(update_fields=("max_participants",))
		self.client.login(username="organizer", password="pass-12345")
		self.client.post(reverse("generate_bracket", args=(self.tournament.slug,)))
		semis = self.tournament.matches.filter(round=1).order_by("id")
		self.client.post(reverse("match_result", args=(semis[0].id,)), {"winner": self.player.id, "score": "2-0", "status": "Completed"})
		self.client.post(reverse("match_result", args=(semis[1].id,)), {"winner": semis[1].player_two.id, "score": "2-1", "status": "Completed"})
		final = self.tournament.matches.get(round=2)
		self.client.post(reverse("match_result", args=(final.id,)), {"winner": self.player.id, "score": "2-1", "status": "Completed"})
		self.tournament.refresh_from_db()
		self.assertEqual(self.tournament.status, "Completed")
		self.player.refresh_from_db()
		self.assertEqual(self.player.tournament_wins, 1)

	def test_organizer_dashboard_shows_overview_and_management_actions(self):
		self.client.login(username="organizer", password="pass-12345")
		response = self.client.get(reverse("tournament_manage", args=[self.tournament.slug]))
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Overview")
		self.assertContains(response, "Registrations")
		self.assertContains(response, "Matches")
		self.assertContains(response, "Generate bracket")
		self.assertContains(response, "Delete tournament")

	def test_organizer_can_toggle_registration_and_cancel_tournament(self):
		self.client.login(username="organizer", password="pass-12345")
		close_response = self.client.post(reverse("tournament_toggle_registration", args=[self.tournament.slug]))
		self.assertEqual(close_response.status_code, 302)
		self.tournament.refresh_from_db()
		self.assertEqual(self.tournament.status, "Registration Closed")

		open_response = self.client.post(reverse("tournament_toggle_registration", args=[self.tournament.slug]))
		self.assertEqual(open_response.status_code, 302)
		self.tournament.refresh_from_db()
		self.assertEqual(self.tournament.status, "Registration Open")

		cancel_response = self.client.post(reverse("tournament_cancel", args=[self.tournament.slug]))
		self.assertEqual(cancel_response.status_code, 302)
		self.tournament.refresh_from_db()
		self.assertEqual(self.tournament.status, "Cancelled")

		self.client.logout()
		self.client.login(username="player", password="pass-12345")
		response = self.client.post(reverse("tournament_toggle_registration", args=[self.tournament.slug]))
		self.assertEqual(response.status_code, 404)

	def test_organizer_can_delete_tournament_but_other_users_cannot(self):
		self.client.login(username="organizer", password="pass-12345")
		response = self.client.post(reverse("tournament_delete", args=[self.tournament.slug]))
		self.assertEqual(response.status_code, 302)
		self.assertFalse(Tournament.objects.filter(id=self.tournament.id).exists())
		self.client.logout()
		self.client.login(username="player", password="pass-12345")
		response = self.client.post(reverse("tournament_delete", args=[self.tournament.slug]))
		self.assertEqual(response.status_code, 404)

	def test_tournament_detail_exposes_challenge_workflow(self):
		self.client.login(username="player", password="pass-12345")
		response = self.client.get(reverse("tournament_detail", args=[self.tournament.slug]))
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Challenge a player")
		self.assertContains(response, "Send challenge")

		response = self.client.post(
			reverse("challenge_create", args=[self.tournament.slug]),
			{
				"opponent": self.organizer.id,
				"game": self.game.id,
				"tournament": self.tournament.id,
				"scheduled_at": "2030-01-02T10:00",
			},
		)
		self.assertEqual(response.status_code, 302)
		self.assertTrue(Challenge.objects.filter(challenger=self.player, opponent=self.organizer).exists())

	def test_challenge_cannot_target_self(self):
		self.client.login(username="organizer", password="pass-12345")
		response = self.client.post(reverse("challenge_create", args=[self.tournament.slug]), {"opponent": self.organizer.id, "game": self.game.id, "tournament": self.tournament.id})
		self.assertEqual(response.status_code, 200)
		self.assertFalse(Challenge.objects.exists())

	def test_match_result_requires_participant_or_organizer(self):
		outsider = GamerProfile.objects.create(user=User.objects.create_user(username="outsider", password="pass-12345"), gamer_tag="OutsiderZW")
		match = TournamentMatch.objects.create(tournament=self.tournament, game=self.game, player_one=self.player, player_two=self.organizer)
		self.client.login(username="outsider", password="pass-12345")
		self.assertEqual(self.client.get(reverse("match_result", args=[match.id])).status_code, 403)

	def test_single_elimination_bracket_and_winner_advancement(self):
		players = [self.player]
		for index in range(3):
			players.append(GamerProfile.objects.create(user=User.objects.create_user(username=f"p{index}"), gamer_tag=f"P{index}"))
		for player in players:
			TournamentRegistration.objects.create(tournament=self.tournament, player=player)
		self.tournament.max_participants = 4
		self.tournament.save(update_fields=("max_participants",))
		self.client.login(username="organizer", password="pass-12345")
		self.client.post(reverse("generate_bracket", args=(self.tournament.slug,)))
		self.assertEqual(self.tournament.matches.count(), 3)
		self.assertEqual(self.tournament.matches.filter(round=2).count(), 1)
		match = self.tournament.matches.filter(round=1, player_one=self.player, status="Scheduled").first()
		response = self.client.post(reverse("match_result", args=(match.id,)), {"winner": self.player.id, "score": "2-0", "status": "Completed"})
		self.assertEqual(response.status_code, 302)
		match.refresh_from_db()
		self.assertEqual(match.status, "Completed")
		self.assertEqual(match.winner, self.player)
		self.assertEqual(TournamentMatch.objects.get(id=match.next_match_id).player_one, self.player)
		final = self.tournament.matches.filter(round=2).first()
		final.player_one = self.player
		final.player_two = self.organizer
		final.save(update_fields=("player_one", "player_two"))
		self.client.post(reverse("match_result", args=(final.id,)), {"winner": self.player.id, "score": "2-1", "status": "Completed"})
		self.organizer.refresh_from_db()
		self.player.refresh_from_db()
		self.assertEqual(self.player.tournament_wins, 1)

	def test_match_schedule_requires_tournament_owner(self):
		match = TournamentMatch.objects.create(tournament=self.tournament, game=self.game, player_one=self.player, player_two=self.organizer)
		self.client.login(username="organizer", password="pass-12345")
		self.assertEqual(self.client.post(reverse("match_schedule", args=(match.id,)), {"scheduled_at": "2030-01-01T10:00"}).status_code, 302)
		match.refresh_from_db()
		self.assertIsNotNone(match.scheduled_at)
		self.client.login(username="player", password="pass-12345")
		self.assertEqual(self.client.post(reverse("match_schedule", args=(match.id,)), {"scheduled_at": "2030-01-02T10:00"}).status_code, 404)

	def test_match_schedule_form_renders_without_tournament_template_error(self):
		match = TournamentMatch.objects.create(tournament=self.tournament, game=self.game, player_one=self.player, player_two=self.organizer)
		self.client.login(username="organizer", password="pass-12345")
		response = self.client.get(reverse("match_schedule", args=(match.id,)))
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Schedule match")

	def test_match_creation_and_result_require_registered_players(self):
		outsider = GamerProfile.objects.create(user=User.objects.create_user(username="unregistered"), gamer_tag="Unregistered")
		self.client.login(username="organizer", password="pass-12345")
		response = self.client.post(reverse("match_create", args=(self.tournament.slug,)), {"game": self.game.id, "player_one": self.player.id, "player_two": outsider.id, "round": 1, "status": "Scheduled"})
		self.assertEqual(response.status_code, 200)
		self.assertFalse(TournamentMatch.objects.exists())

	def test_cleared_conversation_is_not_counted_as_unread(self):
		from accounts.models import Conversation, ConversationParticipant, Message
		from django.utils import timezone
		conversation = Conversation.objects.create()
		ConversationParticipant.objects.create(conversation=conversation, profile=self.organizer)
		ConversationParticipant.objects.create(conversation=conversation, profile=self.player)
		Message.objects.create(conversation=conversation, sender=self.player, body="Hi")
		self.client.login(username="organizer", password="pass-12345")
		self.client.post(reverse("conversation_detail", args=(conversation.id,)), {"action": "clear"})
		self.assertNotContains(self.client.get(reverse("conversation_list")), "Hi")
