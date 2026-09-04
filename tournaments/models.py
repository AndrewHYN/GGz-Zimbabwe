from django.db import models

from accounts.models import GamerProfile
from games.models import Game


class Tournament(models.Model):
	STATUS_CHOICES = [(value, value) for value in ("Draft", "Registration Open", "Registration Closed", "Live", "Completed", "Cancelled")]
	FORMAT_CHOICES = [(value, value) for value in ("1v1", "2v2", "3v3", "4v4", "5v5", "Free For All")]
	MODE_CHOICES = [("online", "Online"), ("offline", "Offline")]

	organizer = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="organized_tournaments")
	game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="tournaments")
	name = models.CharField(max_length=160)
	slug = models.SlugField(max_length=180, unique=True)
	description = models.TextField(max_length=3000)
	banner = models.ImageField(upload_to="tournaments/", blank=True, null=True)
	format = models.CharField(max_length=20, choices=FORMAT_CHOICES)
	max_participants = models.PositiveIntegerField(default=32)
	start_date = models.DateTimeField()
	registration_deadline = models.DateTimeField()
	location = models.CharField(max_length=120, blank=True)
	city = models.CharField(max_length=120, blank=True)
	province = models.CharField(max_length=120, blank=True)
	country = models.CharField(max_length=100, blank=True, default="Zimbabwe")
	venue = models.ForeignKey("accounts.Venue", on_delete=models.SET_NULL, blank=True, null=True, related_name="tournaments")
	latitude = models.FloatField(blank=True, null=True)
	longitude = models.FloatField(blank=True, null=True)
	mode = models.CharField(max_length=10, choices=MODE_CHOICES, default="online")
	entry_type = models.CharField(max_length=20, default="Free")
	prize_description = models.CharField(max_length=300, blank=True)
	rules = models.TextField(blank=True, max_length=3000)
	status = models.CharField(max_length=25, choices=STATUS_CHOICES, default="Draft")
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ("start_date",)
		indexes = [models.Index(fields=("status", "start_date")), models.Index(fields=("location",))]

	def __str__(self):
		return self.name

	@property
	def participant_count(self):
		return self.registrations.filter(status="Registered").count()


class TournamentRegistration(models.Model):
	STATUS_CHOICES = [(value, value) for value in ("Registered", "Waitlisted", "Withdrawn", "Disqualified")]
	tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="registrations")
	player = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="tournament_registrations")
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Registered")
	joined_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		constraints = [models.UniqueConstraint(fields=("tournament", "player"), name="unique_tournament_registration")]


class TournamentInvitation(models.Model):
	STATUS_CHOICES = [(value, value) for value in ("Pending", "Accepted", "Declined")]
	tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="invitations")
	player = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="tournament_invitations")
	status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="Pending")
	created_at = models.DateTimeField(auto_now_add=True)
	responded_at = models.DateTimeField(blank=True, null=True)

	class Meta:
		constraints = [models.UniqueConstraint(fields=("tournament", "player"), name="unique_tournament_invitation")]
		ordering = ("-created_at",)


class Challenge(models.Model):
	STATUS_CHOICES = [(value, value) for value in ("Pending", "Accepted", "Declined", "Cancelled", "Scheduled", "Completed")]
	challenger = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="challenges_made")
	opponent = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="challenges_received")
	game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="challenges")
	tournament = models.ForeignKey(Tournament, on_delete=models.SET_NULL, blank=True, null=True, related_name="challenges")
	status = models.CharField(max_length=15, choices=STATUS_CHOICES, default="Pending")
	scheduled_at = models.DateTimeField(blank=True, null=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		constraints = [models.CheckConstraint(condition=~models.Q(challenger=models.F("opponent")), name="no_self_challenge")]


class TournamentMatch(models.Model):
	STATUS_CHOICES = [(value, value) for value in ("Scheduled", "Live", "Completed", "Cancelled")]
	tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="matches")
	game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="matches")
	player_one = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, null=True, blank=True, related_name="matches_as_one")
	player_two = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, null=True, blank=True, related_name="matches_as_two")
	winner = models.ForeignKey(GamerProfile, on_delete=models.SET_NULL, blank=True, null=True, related_name="matches_won")
	round = models.PositiveIntegerField(default=1)
	scheduled_at = models.DateTimeField(blank=True, null=True)
	score = models.CharField(max_length=30, blank=True)
	status = models.CharField(max_length=15, choices=STATUS_CHOICES, default="Scheduled")
	created_at = models.DateTimeField(auto_now_add=True)
	next_match = models.ForeignKey("self", on_delete=models.SET_NULL, blank=True, null=True, related_name="source_matches")

	class Meta:
		constraints = [models.CheckConstraint(condition=~models.Q(player_one=models.F("player_two")), name="match_players_are_different")]
