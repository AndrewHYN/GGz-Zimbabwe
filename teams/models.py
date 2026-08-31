from django.db import models
from django.db.models import Q
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

    @property
    def member_ids(self):
        return list(self.memberships.values_list("player_id", flat=True))

    @property
    def tournament_history(self):
        from tournaments.models import Tournament

        return (
            Tournament.objects.filter(registrations__player__team_memberships__team=self)
            .distinct()
            .select_related("game", "organizer__user")
            .order_by("-start_date")
        )

    @property
    def matches_played(self):
        from tournaments.models import TournamentMatch

        return (
            TournamentMatch.objects.filter(
                status="Completed",
            )
            .filter(Q(player_one__team_memberships__team=self) | Q(player_two__team_memberships__team=self))
            .distinct()
            .count()
        )

    @property
    def wins(self):
        from tournaments.models import TournamentMatch

        return (
            TournamentMatch.objects.filter(
                status="Completed",
                winner__team_memberships__team=self,
            )
            .filter(Q(player_one__team_memberships__team=self) | Q(player_two__team_memberships__team=self))
            .distinct()
            .count()
        )

    @property
    def losses(self):
        return self.matches_played - self.wins

    @property
    def win_rate(self):
        if not self.matches_played:
            return 0
        return round((self.wins / self.matches_played) * 100, 1)


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
