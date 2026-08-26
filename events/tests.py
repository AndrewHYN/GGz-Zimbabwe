from datetime import timedelta
from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from accounts.models import GamerProfile
from .models import Event


class EventManagementTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(username="event-owner", password="pass")
		self.profile = GamerProfile.objects.create(user=self.user, gamer_tag="EventOwner")
		self.other = User.objects.create_user(username="other", password="pass")
		self.event = Event.objects.create(organizer=self.profile, name="Meetup", description="Play", start_date=timezone.now() + timedelta(days=1))

	def test_create_edit_cancel_and_authorization(self):
		self.client.login(username="event-owner", password="pass")
		response = self.client.post(reverse("event_create"), {"name": "New", "description": "Event", "start_date": "2030-01-01T10:00", "mode": "online", "status": "Upcoming"})
		self.assertEqual(response.status_code, 302)
		self.client.post(reverse("event_edit", args=(self.event.id,)), {"name": "Updated", "description": "Play more", "start_date": "2030-01-01T10:00", "mode": "online", "status": "Upcoming"})
		self.event.refresh_from_db()
		self.assertEqual(self.event.name, "Updated")
		self.client.post(reverse("event_cancel", args=(self.event.id,)))
		self.event.refresh_from_db()
		self.assertEqual(self.event.status, "Cancelled")
		self.client.login(username="other", password="pass")
		self.assertEqual(self.client.get(reverse("event_edit", args=(self.event.id,))).status_code, 404)
		self.assertEqual(self.client.post(reverse("event_cancel", args=(self.event.id,))).status_code, 404)

# Create your tests here.
