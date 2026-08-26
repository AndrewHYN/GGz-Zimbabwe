from django.db import models

from accounts.models import GamerProfile
from games.models import Game


class Event(models.Model):
	STATUS_CHOICES = [("Upcoming", "Upcoming"), ("Live", "Live"), ("Completed", "Completed"), ("Cancelled", "Cancelled")]
	organizer = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="organized_events")
	game = models.ForeignKey(Game, on_delete=models.SET_NULL, null=True, blank=True, related_name="events")
	name = models.CharField(max_length=160)
	description = models.TextField(max_length=3000)
	banner = models.ImageField(upload_to="events/", blank=True, null=True)
	start_date = models.DateTimeField()
	location = models.CharField(max_length=160, blank=True)
	mode = models.CharField(max_length=10, choices=(("online", "Online"), ("offline", "Offline")), default="offline")
	capacity = models.PositiveIntegerField(blank=True, null=True)
	status = models.CharField(max_length=15, choices=STATUS_CHOICES, default="Upcoming")
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ("start_date",)


class EventRsvp(models.Model):
	event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="rsvps")
	attendee = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="event_rsvps")
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		constraints = [models.UniqueConstraint(fields=("event", "attendee"), name="unique_event_rsvp")]
