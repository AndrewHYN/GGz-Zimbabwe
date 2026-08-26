from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from accounts.models import GamerProfile

from .models import Team, TeamInvitation, TeamMembership


class TeamInvitationTests(TestCase):
    def setUp(self):
        self.owner = GamerProfile.objects.create(user=User.objects.create_user(username="owner", password="pass"), gamer_tag="Owner")
        self.invitee = GamerProfile.objects.create(user=User.objects.create_user(username="invitee", password="pass"), gamer_tag="Invitee")
        self.other = GamerProfile.objects.create(user=User.objects.create_user(username="other", password="pass"), gamer_tag="Other")
        self.team = Team.objects.create(owner=self.owner, name="Squad", tag="SQ", slug="squad")
        self.invitation = TeamInvitation.objects.create(team=self.team, inviter=self.owner, invitee=self.invitee)

    def test_invitation_display_and_accept(self):
        self.client.login(username="invitee", password="pass")
        self.assertContains(self.client.get(reverse("team_invitations")), "Squad")
        self.client.post(reverse("team_invitation_action", args=(self.invitation.id, "accept")))
        self.assertTrue(TeamMembership.objects.filter(team=self.team, player=self.invitee).exists())
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.status, "Accepted")

    def test_decline_and_unauthorized_access(self):
        self.client.login(username="other", password="pass")
        self.assertEqual(self.client.post(reverse("team_invitation_action", args=(self.invitation.id, "accept"))).status_code, 404)
        self.client.login(username="invitee", password="pass")
        self.client.post(reverse("team_invitation_action", args=(self.invitation.id, "decline")))
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.status, "Declined")

    def test_duplicate_team_names_are_rejected(self):
        self.client.login(username="owner", password="pass")
        response = self.client.post(reverse("team_create"), {"name": "Squad", "tag": "SQ"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "already exists")
