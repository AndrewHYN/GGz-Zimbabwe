from datetime import timedelta

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from accounts.models import Block, GamerProfile, Notification
from games.models import Game
from teams.models import Team, TeamMembership

from .models import Challenge, Tournament, TournamentInvitation, TournamentMatch, TournamentRegistration


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

	def test_tournament_detail_api_register_and_leave(self):
		response = self.client.get(reverse("api_tournament_detail", args=[self.tournament.slug]))
		self.assertEqual(response.status_code, 200)
		payload = response.json()
		self.assertEqual(payload["slug"], "ggz-cup")
		self.assertEqual(payload["participant_count"], 0)
		self.assertIsNone(payload["registration_status"])
		self.assertEqual(self.client.get(reverse("api_tournament_detail", args=["no-such-cup"])).status_code, 404)
		self.player.games.add(self.game)
		self.client.login(username="player", password="pass-12345")
		register = self.client.post(reverse("api_tournament_register", args=[self.tournament.slug]), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
		self.assertTrue(register.json()["registered"])
		self.assertTrue(TournamentRegistration.objects.filter(tournament=self.tournament, player=self.player, status="Registered").exists())
		detail = self.client.get(reverse("api_tournament_detail", args=[self.tournament.slug])).json()
		self.assertEqual(detail["registration_status"], "Registered")
		self.assertEqual(detail["participant_count"], 1)
		self.assertEqual(detail["participants"][0]["gamer_tag"], "PlayerZW")
		leave = self.client.post(reverse("api_tournament_leave", args=[self.tournament.slug]), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
		self.assertFalse(leave.json()["registered"])
		self.assertEqual(TournamentRegistration.objects.get(tournament=self.tournament, player=self.player).status, "Withdrawn")

	def test_tournament_detail_exposes_contextual_contact_for_players(self):
		self.client.login(username="player", password="pass-12345")
		response = self.client.get(reverse("tournament_detail", args=[self.tournament.slug]))
		self.assertContains(response, "Contact organizer")
		contact_url = reverse("conversation_start", args=(self.organizer.gamer_tag,))
		self.assertContains(response, f'action="{contact_url}"')
		TournamentRegistration.objects.create(tournament=self.tournament, player=self.player)
		response = self.client.get(reverse("tournament_detail", args=[self.tournament.slug]))
		self.assertContains(response, "Contact organizer")

	def test_tournament_banner_save_writes_to_configured_storage(self):
		self.tournament.banner = SimpleUploadedFile("banner.jpg", b"banner-data")
		self.tournament.save(update_fields=("banner",))
		try:
			self.assertTrue(self.tournament.banner.storage.exists(self.tournament.banner.name))
		finally:
			self.tournament.banner.delete(save=False)

	def test_registration_and_duplicate_prevention(self):
		self.player.games.add(self.game)
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
		self.assertEqual(set(TournamentRegistration.objects.filter(tournament=tournament).values_list("team_id", flat=True)), {team.id})

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
		self.client.login(username="organizer", password="pass-12345")
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
		self.assertContains(response, 'method="post"', html=False)
		self.assertContains(response, f'action="{reverse("generate_bracket", args=[self.tournament.slug])}"', html=False)

	def test_organizer_can_invite_eligible_game_players_and_manage_statuses(self):
		self.player.games.add(self.game)
		self.client.login(username="organizer", password="pass-12345")
		response = self.client.get(reverse("tournament_manage", args=[self.tournament.slug]))
		self.assertContains(response, "Invite players")
		self.assertContains(response, "PlayerZW")
		invite_response = self.client.post(reverse("tournament_invite", args=[self.tournament.slug]), {"player_ids": [self.player.id]})
		self.assertRedirects(invite_response, reverse("tournament_manage", args=[self.tournament.slug]))
		invitation = TournamentInvitation.objects.get(tournament=self.tournament, player=self.player)
		self.assertEqual(invitation.status, "Pending")
		self.assertTrue(Notification.objects.filter(recipient=self.player, notification_type="tournament_invitation").exists())
		self.assertContains(self.client.get(reverse("tournament_manage", args=[self.tournament.slug])), "Awaiting response")

	def test_invitation_rejects_non_organizer_self_duplicate_and_blocked_players(self):
		self.player.games.add(self.game)
		self.client.login(username="player", password="pass-12345")
		self.assertEqual(self.client.post(reverse("tournament_invite", args=[self.tournament.slug]), {"player_ids": [self.player.id]}).status_code, 404)
		self.client.login(username="organizer", password="pass-12345")
		self.assertEqual(self.client.post(reverse("tournament_invite", args=[self.tournament.slug]), {"player_ids": [self.organizer.id]}).status_code, 302)
		Block.objects.create(blocker=self.organizer, blocked=self.player)
		self.assertEqual(self.client.get(reverse("tournament_manage", args=[self.tournament.slug])).context["invite_candidates"].count(), 0)

	def test_player_can_accept_or_decline_invitation_once(self):
		self.player.games.add(self.game)
		invitation = TournamentInvitation.objects.create(tournament=self.tournament, player=self.player)
		self.client.login(username="player", password="pass-12345")
		accept_response = self.client.post(reverse("tournament_invitation_action", args=[invitation.id, "accept"]))
		self.assertRedirects(accept_response, reverse("tournament_detail", args=[self.tournament.slug]))
		self.assertTrue(TournamentRegistration.objects.filter(tournament=self.tournament, player=self.player, status="Registered").exists())
		invitation.refresh_from_db()
		self.assertEqual(invitation.status, "Accepted")
		self.assertEqual(self.client.post(reverse("tournament_invitation_action", args=[invitation.id, "accept"])).status_code, 404)

		declined_player = GamerProfile.objects.create(user=User.objects.create_user(username="decliner", password="pass-12345"), gamer_tag="DeclinerZW")
		declined = TournamentInvitation.objects.create(tournament=self.tournament, player=declined_player)
		self.client.login(username="decliner", password="pass-12345")
		self.client.post(reverse("tournament_invitation_action", args=[declined.id, "decline"]))
		declined.refresh_from_db()
		self.assertEqual(declined.status, "Declined")
		self.assertFalse(TournamentRegistration.objects.filter(tournament=self.tournament, player=declined_player).exists())

	def test_invitation_acceptance_checks_capacity(self):
		self.player.games.add(self.game)
		full_player = GamerProfile.objects.create(user=User.objects.create_user(username="fullplayer", password="pass-12345"), gamer_tag="FullPlayerZW")
		TournamentRegistration.objects.create(tournament=self.tournament, player=full_player)
		invitation = TournamentInvitation.objects.create(tournament=self.tournament, player=self.player)
		self.client.login(username="player", password="pass-12345")
		self.assertEqual(self.client.post(reverse("tournament_invitation_action", args=[invitation.id, "accept"])).status_code, 403)
		self.assertFalse(TournamentRegistration.objects.filter(tournament=self.tournament, player=self.player).exists())

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

	def test_cancelled_tournament_cannot_reopen_registration(self):
		self.tournament.status = "Cancelled"
		self.tournament.save(update_fields=("status",))
		self.client.login(username="organizer", password="pass-12345")
		response = self.client.post(reverse("tournament_toggle_registration", args=[self.tournament.slug]))
		self.assertEqual(response.status_code, 403)
		self.tournament.refresh_from_db()
		self.assertEqual(self.tournament.status, "Cancelled")

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

	def test_blocked_player_cannot_send_challenge(self):
		Block.objects.create(blocker=self.organizer, blocked=self.player)
		self.client.login(username="player", password="pass-12345")
		response = self.client.post(reverse("challenge_create", args=[self.tournament.slug]), {"opponent": self.organizer.id, "game": self.game.id, "tournament": self.tournament.id})
		self.assertContains(response, "You cannot challenge this player.")
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
		final.player_two = players[1]
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

	def _register(self, player):
		TournamentRegistration.objects.get_or_create(tournament=self.tournament, player=player)

	def _eligible_match(self, player_two):
		match = TournamentMatch.objects.create(tournament=self.tournament, game=self.game, player_one=self.player, player_two=player_two)
		self.player.games.add(self.game)
		player_two.games.add(self.game)
		self._register(self.player)
		self._register(player_two)
		return match

	def test_bracket_cannot_crown_champion_before_the_final(self):
		players = [self.player]
		for index in range(3):
			players.append(GamerProfile.objects.create(user=User.objects.create_user(username=f"flow{index}"), gamer_tag=f"Flow{index}"))
		for player in players:
			self._register(player)
		self.tournament.max_participants = 4
		self.tournament.save(update_fields=("max_participants",))
		self.client.login(username="organizer", password="pass-12345")
		self.client.post(reverse("generate_bracket", args=(self.tournament.slug,)))
		semis = self.tournament.matches.filter(round=1).order_by("id")
		final = self.tournament.matches.get(round=2)
		self.assertEqual(len(semis), 2)
		self.assertEqual(final.status, "Scheduled")
		self.assertIsNone(final.winner_id)
		self.client.post(reverse("match_result", args=(semis[0].id,)), {"winner": semis[0].player_one_id, "score": "2-0"})
		final.refresh_from_db()
		self.tournament.refresh_from_db()
		self.assertEqual(final.status, "Scheduled")
		self.assertIsNone(final.winner_id)
		self.assertNotEqual(final.score, "Bye")
		self.assertEqual(final.player_one_id, semis[0].player_one_id)
		self.assertNotEqual(self.tournament.status, "Completed")
		self.client.post(reverse("match_result", args=(semis[1].id,)), {"winner": semis[1].player_two_id, "score": "2-1"})
		final.refresh_from_db()
		self.assertEqual(final.status, "Scheduled")
		self.assertIsNone(final.winner_id)
		self.assertEqual(final.player_two_id, semis[1].player_two_id)
		self.tournament.refresh_from_db()
		self.assertNotEqual(self.tournament.status, "Completed")
		self.client.post(reverse("match_result", args=(final.id,)), {"winner": final.player_one_id, "score": "2-1"})
		final.refresh_from_db()
		self.tournament.refresh_from_db()
		self.assertEqual(final.status, "Completed")
		self.assertEqual(final.winner_id, final.player_one_id)
		self.assertEqual(self.tournament.status, "Completed")
		self.player.refresh_from_db()
		self.assertEqual(self.player.tournament_wins, 1)

	def test_bye_match_advances_without_completing_the_tournament(self):
		players = [self.player]
		for index in range(2):
			players.append(GamerProfile.objects.create(user=User.objects.create_user(username=f"byeflow{index}"), gamer_tag=f"ByeFlow{index}"))
		for player in players:
			self._register(player)
		self.tournament.max_participants = 4
		self.tournament.save(update_fields=("max_participants",))
		self.client.login(username="organizer", password="pass-12345")
		self.client.post(reverse("generate_bracket", args=(self.tournament.slug,)))
		self.assertEqual(self.tournament.matches.count(), 3)
		bye_match = self.tournament.matches.get(score="Bye")
		self.assertIsNone(bye_match.player_two_id)
		self.assertEqual(bye_match.status, "Completed")
		final = self.tournament.matches.get(round=2)
		self.assertEqual(final.status, "Scheduled")
		self.assertIsNone(final.winner_id)
		self.assertNotEqual(final.score, "Bye")
		self.assertEqual(final.player_two_id, bye_match.player_one_id)
		self.tournament.refresh_from_db()
		self.assertNotEqual(self.tournament.status, "Completed")
		real_semi = self.tournament.matches.filter(round=1).exclude(pk=bye_match.pk).get()
		real_winner = real_semi.player_one
		response = self.client.post(reverse("match_result", args=(real_semi.id,)), {"winner": real_winner.id, "score": "2-1"})
		self.assertEqual(response.status_code, 302)
		final.refresh_from_db()
		self.assertEqual(final.player_one_id, real_winner.id)
		self.assertEqual(final.status, "Scheduled")
		self.client.post(reverse("match_result", args=(final.id,)), {"winner": real_winner.id, "score": "2-0"})
		final.refresh_from_db()
		self.tournament.refresh_from_db()
		self.assertEqual(final.score, "2-0")
		self.assertEqual(final.status, "Completed")
		self.assertEqual(self.tournament.status, "Completed")
		real_winner.refresh_from_db()
		self.assertEqual(real_winner.tournament_wins, 1)
		bye_match.player_one.refresh_from_db()
		self.assertEqual(bye_match.player_one.tournament_wins, 0)

	def test_bracket_generation_creates_no_empty_matches(self):
		players = [self.player]
		for index in range(4):
			players.append(GamerProfile.objects.create(user=User.objects.create_user(username=f"phantom{index}"), gamer_tag=f"Phantom{index}"))
		for player in players:
			self._register(player)
		self.tournament.max_participants = 8
		self.tournament.save(update_fields=("max_participants",))
		self.client.login(username="organizer", password="pass-12345")
		self.client.post(reverse("generate_bracket", args=(self.tournament.slug,)))
		self.assertEqual(self.tournament.matches.count(), 7)
		self.assertEqual(self.tournament.matches.filter(round=1).count(), 4)
		self.assertEqual(self.tournament.matches.filter(round=2).count(), 2)
		self.assertEqual(self.tournament.matches.filter(round=3).count(), 1)
		self.assertFalse(self.tournament.matches.filter(round=1, player_one_id__isnull=True, player_two_id__isnull=True).exists())
		self.assertFalse(self.tournament.matches.filter(round=1, player_one_id__isnull=True).exists())
		self.assertEqual(self.tournament.matches.filter(score="Bye").count(), 3)
		self.tournament.refresh_from_db()
		self.assertNotEqual(self.tournament.status, "Completed")

	def test_duplicate_result_is_rejected_without_double_counting(self):
		self.tournament.max_participants = 2
		self.tournament.save(update_fields=("max_participants",))
		opponent = GamerProfile.objects.create(user=User.objects.create_user(username="duel"), gamer_tag="DuelZW")
		self.player.games.add(self.game)
		opponent.games.add(self.game)
		self._register(self.player)
		self._register(opponent)
		self.client.login(username="organizer", password="pass-12345")
		self.client.post(reverse("generate_bracket", args=(self.tournament.slug,)))
		self.assertEqual(self.tournament.matches.count(), 1)
		match = self.tournament.matches.get()
		response = self.client.post(reverse("match_result", args=(match.id,)), {"winner": self.player.id, "score": "2-0"})
		self.assertEqual(response.status_code, 302)
		match.refresh_from_db()
		self.assertEqual(match.status, "Completed")
		self.assertEqual(match.winner_id, self.player.id)
		self.tournament.refresh_from_db()
		self.assertEqual(self.tournament.status, "Completed")
		self.player.refresh_from_db()
		self.assertEqual(self.player.tournament_wins, 1)
		second = self.client.post(reverse("match_result", args=(match.id,)), {"winner": self.player.id, "score": "3-0"})
		self.assertEqual(second.status_code, 200)
		self.assertContains(second, "already has a recorded result")
		self.tournament.refresh_from_db()
		self.assertEqual(self.tournament.status, "Completed")
		self.player.refresh_from_db()
		self.assertEqual(self.player.tournament_wins, 1)
		opponent.refresh_from_db()
		self.assertEqual(opponent.tournament_wins, 0)

	def test_match_result_is_limited_to_organizer_or_staff(self):
		opponent = GamerProfile.objects.create(user=User.objects.create_user(username="authority"), gamer_tag="AuthorityZW")
		GamerProfile.objects.create(user=User.objects.create_user(username="authority-outside", password="pass-12345"), gamer_tag="AuthorityOutsideZW")
		match = self._eligible_match(opponent)
		self.client.login(username="authority-outside", password="pass-12345")
		self.assertEqual(self.client.post(reverse("match_result", args=(match.id,)), {"winner": self.player.id, "score": "2-0"}).status_code, 403)
		self.client.login(username="player", password="pass-12345")
		self.assertEqual(self.client.post(reverse("match_result", args=(match.id,)), {"winner": self.player.id, "score": "2-0"}).status_code, 403)
		match.refresh_from_db()
		self.assertEqual(match.status, "Scheduled")
		self.client.login(username="organizer", password="pass-12345")
		self.assertEqual(self.client.post(reverse("match_result", args=(match.id,)), {"winner": self.player.id, "score": "2-0"}).status_code, 302)
		staff_user = User.objects.create_user(username="referee", password="pass-12345", is_staff=True)
		GamerProfile.objects.create(user=staff_user, gamer_tag="RefereeZW")
		staff_match = self._eligible_match(opponent)
		self.client.login(username="referee", password="pass-12345")
		self.assertEqual(self.client.post(reverse("match_result", args=(staff_match.id,)), {"winner": opponent.id, "score": "2-0"}).status_code, 302)
		staff_match.refresh_from_db()
		self.assertEqual(staff_match.status, "Completed")
		self.assertEqual(staff_match.winner_id, opponent.id)

	def test_client_submitted_status_cannot_force_match_state(self):
		opponent = GamerProfile.objects.create(user=User.objects.create_user(username="status"), gamer_tag="StatusZW")
		match = self._eligible_match(opponent)
		self.client.login(username="organizer", password="pass-12345")
		self.client.post(reverse("match_result", args=(match.id,)), {"winner": self.player.id, "score": "2-0", "status": "Cancelled"})
		match.refresh_from_db()
		self.assertEqual(match.status, "Completed")
		self.assertEqual(match.score, "2-0")
		second = TournamentMatch.objects.create(tournament=self.tournament, game=self.game, player_one=self.player, player_two=opponent)
		response = self.client.post(reverse("match_result", args=(second.id,)), {"status": "Completed"})
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "requires a winner and score")
		second.refresh_from_db()
		self.assertEqual(second.status, "Scheduled")
		self.assertIsNone(second.winner_id)

	def test_player_cannot_leave_after_bracket_generation(self):
		opponent = GamerProfile.objects.create(user=User.objects.create_user(username="leave"), gamer_tag="LeaveZW")
		self.player.games.add(self.game)
		opponent.games.add(self.game)
		self._register(self.player)
		self._register(opponent)
		self.tournament.max_participants = 2
		self.tournament.save(update_fields=("max_participants",))
		self.client.login(username="player", password="pass-12345")
		leave_url = reverse("tournament_leave", args=(self.tournament.slug,))
		self.assertEqual(self.client.post(leave_url).status_code, 302)
		self.tournament.refresh_from_db()
		self.assertFalse(self.tournament.registrations.filter(player=self.player, status="Registered").exists())
		self.assertEqual(self.client.post(reverse("tournament_register", args=(self.tournament.slug,))).status_code, 302)
		self.client.login(username="organizer", password="pass-12345")
		self.client.post(reverse("generate_bracket", args=(self.tournament.slug,)))
		self.client.login(username="player", password="pass-12345")
		self.assertEqual(self.client.post(leave_url).status_code, 403)
		self.tournament.refresh_from_db()
		self.assertTrue(self.tournament.registrations.filter(player=self.player, status="Registered").exists())

	def test_self_registration_requires_owning_the_tournament_game(self):
		url = reverse("tournament_register", args=(self.tournament.slug,))
		self.client.login(username="player", password="pass-12345")
		self.assertEqual(self.client.post(url).status_code, 403)
		self.assertFalse(TournamentRegistration.objects.filter(tournament=self.tournament, player=self.player).exists())
		self.player.games.add(self.game)
		self.assertEqual(self.client.post(url).status_code, 302)
		self.assertTrue(TournamentRegistration.objects.filter(tournament=self.tournament, player=self.player, status="Registered").exists())

	def test_invitation_acceptance_requires_owning_the_tournament_game(self):
		invitation = TournamentInvitation.objects.create(tournament=self.tournament, player=self.player)
		url = reverse("tournament_invitation_action", args=(invitation.id, "accept"))
		self.client.login(username="player", password="pass-12345")
		self.assertEqual(self.client.post(url).status_code, 403)
		self.assertFalse(TournamentRegistration.objects.filter(tournament=self.tournament, player=self.player).exists())
		self.player.games.add(self.game)
		self.assertEqual(self.client.post(url).status_code, 302)
		self.assertTrue(TournamentRegistration.objects.filter(tournament=self.tournament, player=self.player, status="Registered").exists())

	def test_registration_rejected_after_bracket_generation(self):
		opponent = GamerProfile.objects.create(user=User.objects.create_user(username="locker", password="pass-12345"), gamer_tag="LockerZW")
		outsider = GamerProfile.objects.create(user=User.objects.create_user(username="outsider", password="pass-12345"), gamer_tag="OutsiderZW")
		for profile in (self.player, opponent, outsider):
			profile.games.add(self.game)
		self._register(self.player)
		self._register(opponent)
		self.tournament.max_participants = 4
		self.tournament.save(update_fields=("max_participants",))
		self.client.login(username="organizer", password="pass-12345")
		self.assertEqual(self.client.post(reverse("generate_bracket", args=(self.tournament.slug,))).status_code, 302)
		self.client.login(username="outsider", password="pass-12345")
		response = self.client.post(reverse("tournament_register", args=(self.tournament.slug,)))
		self.assertEqual(response.status_code, 403)
		self.assertFalse(TournamentRegistration.objects.filter(tournament=self.tournament, player=outsider).exists())

	def test_invitation_acceptance_rejected_after_bracket_generation(self):
		opponent = GamerProfile.objects.create(user=User.objects.create_user(username="locker2", password="pass-12345"), gamer_tag="LockerTwoZW")
		invitee = GamerProfile.objects.create(user=User.objects.create_user(username="skiptee", password="pass-12345"), gamer_tag="SkipTeeZW")
		for profile in (self.player, opponent, invitee):
			profile.games.add(self.game)
		self._register(self.player)
		self._register(opponent)
		self.tournament.max_participants = 4
		self.tournament.save(update_fields=("max_participants",))
		invitation = TournamentInvitation.objects.create(tournament=self.tournament, player=invitee)
		self.client.login(username="organizer", password="pass-12345")
		self.client.post(reverse("generate_bracket", args=(self.tournament.slug,)))
		self.client.login(username="skiptee", password="pass-12345")
		response = self.client.post(reverse("tournament_invitation_action", args=(invitation.id, "accept")))
		self.assertEqual(response.status_code, 403)
		invitation.refresh_from_db()
		self.assertEqual(invitation.status, "Pending")

	def test_match_result_rejects_winner_outside_match_participants(self):
		opponent = GamerProfile.objects.create(user=User.objects.create_user(username="outlaw", password="pass-12345"), gamer_tag="OutlawZW")
		outside = GamerProfile.objects.create(user=User.objects.create_user(username="imposter", password="pass-12345"), gamer_tag="ImposterZW")
		match = self._eligible_match(opponent)
		self.client.login(username="organizer", password="pass-12345")
		response = self.client.post(reverse("match_result", args=(match.id,)), {"winner": outside.id, "score": "2-0", "status": "Completed"})
		self.assertEqual(response.status_code, 200)
		match.refresh_from_db()
		self.assertEqual(match.status, "Scheduled")
		self.assertIsNone(match.winner_id)

	def test_bracket_round_labels_derived_from_depth(self):
		players = [self.player]
		for index in range(3):
			players.append(GamerProfile.objects.create(user=User.objects.create_user(username=f"deep{index}", password="pass-12345"), gamer_tag=f"Deep{index}ZW"))
		for profile in players:
			self._register(profile)
		self.tournament.max_participants = 4
		self.tournament.save(update_fields=("max_participants",))
		self.client.login(username="organizer", password="pass-12345")
		self.client.post(reverse("generate_bracket", args=(self.tournament.slug,)))
		response = self.client.get(reverse("tournament_detail", args=(self.tournament.slug,)))
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Semifinals")
		self.assertRegex(
			response.content.decode("utf-8"),
			r'(?s)<h4 class="round-title">.*?Final.*?</h4>',
		)
		self.assertNotContains(response, "Round of 15")

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
