from django.db import models
from django.utils.text import slugify

from accounts.models import GamerProfile
from games.models import Game


class Team(models.Model):
    STATUS_CHOICES = [("Active", "Active"), ("Archived", "Archived")]
    owner = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="owned_teams")
    game = models.ForeignKey(Game, on_delete=models.SET_NULL, null=True, blank=True, related_name="teams")
    name = models.CharField(max_length=100)
    tag = models.CharField(max_length=12)
    slug = models.SlugField(unique=True, max_length=120)
    description = models.TextField(max_length=2000, blank=True)
    logo = models.ImageField(upload_to="teams/logos/", blank=True, null=True)
    banner = models.ImageField(upload_to="teams/banners/", blank=True, null=True)
    location = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="Active")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class TeamMembership(models.Model):
    ROLE_CHOICES = [("Captain", "Captain"), ("Member", "Member")]
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="memberships")
    player = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="team_memberships")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="Member")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("team", "player"), name="unique_team_membership")]


class TeamInvitation(models.Model):
    STATUS_CHOICES = [("Pending", "Pending"), ("Accepted", "Accepted"), ("Declined", "Declined")]
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="invitations")
    inviter = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="team_invites_sent")
    invitee = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="team_invites_received")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="Pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("team", "invitee"), name="unique_team_invitation")]
