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
        TeamMembership.objects.create(team=self.team, player=self.owner, role="Captain")

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

    def test_owner_can_invite_and_duplicate_pending_invitation_is_rejected(self):
        self.client.login(username="owner", password="pass")
        response = self.client.post(reverse("team_invite", args=(self.team.slug,)), {"invitee_id": self.other.id})
        self.assertEqual(response.status_code, 302)
        self.assertTrue(TeamInvitation.objects.filter(team=self.team, invitee=self.other, status="Pending").exists())

        response = self.client.post(reverse("team_invite", args=(self.team.slug,)), {"invitee_id": self.other.id})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(TeamInvitation.objects.filter(team=self.team, invitee=self.other, status="Pending").count(), 1)

    def test_self_and_existing_member_invites_are_rejected(self):
        self.client.login(username="owner", password="pass")
        self.assertEqual(self.client.post(reverse("team_invite", args=(self.team.slug,)), {"invitee_id": self.owner.id}).status_code, 200)
        self.assertFalse(TeamInvitation.objects.filter(team=self.team, invitee=self.owner, status="Pending").exists())

        self.member = GamerProfile.objects.create(user=User.objects.create_user(username="member", password="pass"), gamer_tag="Member")
        TeamMembership.objects.create(team=self.team, player=self.member, role="Member")
        response = self.client.post(reverse("team_invite", args=(self.team.slug,)), {"invitee_id": self.member.id})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(TeamInvitation.objects.filter(team=self.team, invitee=self.member, status="Pending").exists())

    def test_non_manager_cannot_invite(self):
        self.client.login(username="invitee", password="pass")
        response = self.client.post(reverse("team_invite", args=(self.team.slug,)), {"invitee_id": self.other.id})
        self.assertEqual(response.status_code, 403)

    def test_member_can_leave_team(self):
        member = GamerProfile.objects.create(user=User.objects.create_user(username="member-leave", password="pass"), gamer_tag="LeaveMember")
        TeamMembership.objects.create(team=self.team, player=member, role="Member")
        self.client.login(username="member-leave", password="pass")
        response = self.client.post(reverse("team_leave", args=(self.team.slug,)))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(TeamMembership.objects.filter(team=self.team, player=member).exists())

    def test_owner_cannot_leave_without_transferring_ownership(self):
        self.client.login(username="owner", password="pass")
        response = self.client.post(reverse("team_leave", args=(self.team.slug,)))
        self.assertEqual(response.status_code, 403)

    def test_owner_can_transfer_ownership_to_member(self):
        member = GamerProfile.objects.create(user=User.objects.create_user(username="member-transfer", password="pass"), gamer_tag="TransferMember")
        TeamMembership.objects.create(team=self.team, player=member, role="Member")
        self.client.login(username="owner", password="pass")
        response = self.client.post(reverse("team_transfer_ownership", args=(self.team.slug,)), {"new_owner_id": member.id})
        self.assertEqual(response.status_code, 302)
        self.team.refresh_from_db()
        self.assertEqual(self.team.owner, member)

    def test_cross_team_management_is_blocked(self):
        other_owner = GamerProfile.objects.create(user=User.objects.create_user(username="otherowner", password="pass"), gamer_tag="OtherOwner")
        other_team = Team.objects.create(owner=other_owner, name="Rivals", tag="RV", slug="rivals")
        TeamMembership.objects.create(team=other_team, player=other_owner, role="Captain")
        member = GamerProfile.objects.create(user=User.objects.create_user(username="member-target", password="pass"), gamer_tag="TargetMember")
        TeamMembership.objects.create(team=self.team, player=member, role="Member")

        self.client.login(username="owner", password="pass")
        response = self.client.post(reverse("team_invite", args=(other_team.slug,)), {"invitee_id": member.id})
        self.assertEqual(response.status_code, 403)

        response = self.client.post(reverse("team_remove_member", args=(other_team.slug, member.id)))
        self.assertEqual(response.status_code, 403)

    def test_duplicate_team_names_are_rejected(self):
        self.client.login(username="owner", password="pass")
        response = self.client.post(reverse("team_create"), {"name": "Squad", "tag": "SQ"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "already exists")
