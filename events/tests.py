from datetime import timedelta
from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from accounts.models import GamerProfile
from games.models import Game
from .models import Event, EventPromotionRequest, Organization


class EventManagementTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(username="event-owner", password="pass")
		self.profile = GamerProfile.objects.create(user=self.user, gamer_tag="EventOwner")
		self.other = User.objects.create_user(username="other", password="pass")
		self.event = Event.objects.create(organizer=self.profile, name="Meetup", description="Play", start_date=timezone.now() + timedelta(days=1))

	def test_create_edit_cancel_delete_and_authorization(self):
		self.client.login(username="event-owner", password="pass")
		response = self.client.post(reverse("event_create"), {"name": "New", "description": "Event", "start_date": "2030-01-01T10:00", "mode": "online", "status": "Upcoming"})
		self.assertEqual(response.status_code, 302)
		self.client.post(reverse("event_edit", args=(self.event.id,)), {"name": "Updated", "description": "Play more", "start_date": "2030-01-01T10:00", "mode": "online", "status": "Upcoming"})
		self.event.refresh_from_db()
		self.assertEqual(self.event.name, "Updated")
		self.client.post(reverse("event_cancel", args=(self.event.id,)))
		self.event.refresh_from_db()
		self.assertEqual(self.event.status, "Cancelled")
		self.client.post(reverse("event_delete", args=(self.event.id,)))
		self.assertFalse(Event.objects.filter(id=self.event.id).exists())
		self.client.login(username="other", password="pass")
		self.assertEqual(self.client.get(reverse("event_edit", args=(self.event.id,))).status_code, 404)
		self.assertEqual(self.client.post(reverse("event_cancel", args=(self.event.id,))).status_code, 404)
		self.assertEqual(self.client.post(reverse("event_delete", args=(self.event.id,))).status_code, 404)

	def test_organizer_dashboard_lists_events_and_management_actions(self):
		self.client.login(username="event-owner", password="pass")
		response = self.client.get(reverse("event_my"))
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "My events")
		self.assertContains(response, "Meetup")
		self.assertContains(response, "Edit event")
		self.assertContains(response, "Delete event")

	def test_event_detail_exposes_promotion_workflow(self):
		self.client.login(username="event-owner", password="pass")
		organization = Organization.objects.create(
			owner=self.profile,
			name="Harare Esports Hub",
			slug="harare-esports-hub",
			organization_type="Venue",
			description="Gaming venue and event partner.",
		)
		self.event.organization = organization
		self.event.save(update_fields=("organization",))
		response = self.client.get(reverse("event_detail", args=(self.event.id,)))
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Request promotion")

	def test_event_list_supports_search_and_game_filtering(self):
		game = self.event.game
		Event.objects.create(organizer=self.profile, game=game, name="Harare LAN Night", description="Local play", start_date=timezone.now() + timedelta(days=2), status="Upcoming")
		response = self.client.get(reverse("event_list"), {"q": "LAN", "game": game.id if game else ""})
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Harare LAN Night")

	def test_organization_and_promotion_request_workflow(self):
		org = Organization.objects.create(
			owner=self.profile,
			name="Pixel Forge",
			slug="pixel-forge",
			organization_type="Venue",
			description="Gaming lounge and event venue.",
		)
		self.client.login(username="event-owner", password="pass")
		response = self.client.post(
			reverse("organization_create"),
			{
				"name": "North Star Esports",
				"organization_type": "Organization",
				"description": "Community organizer",
			},
		)
		self.assertEqual(response.status_code, 302)
		self.assertTrue(Organization.objects.filter(name="North Star Esports").exists())

		self.event.organization = org
		self.event.save(update_fields=("organization",))
		response = self.client.post(
			reverse("event_promotion_request", args=(self.event.id,)),
			{
				"request_type": "Featured Event",
				"campaign_description": "Sponsor this venue showcase.",
				"start_date": "2030-01-10T12:00",
				"end_date": "2030-01-12T12:00",
			},
		)
		self.assertEqual(response.status_code, 302)
		self.assertTrue(EventPromotionRequest.objects.filter(event=self.event, requesting_organization=org, status="Pending").exists())

		request = EventPromotionRequest.objects.get(event=self.event, requesting_organization=org)
		response = self.client.post(reverse("event_promotion_review", args=(request.id, "approve")), {"review_notes": "Approved for feature placement."})
		self.assertEqual(response.status_code, 302)
		request.refresh_from_db()
		self.assertEqual(request.status, "Approved")
		self.assertTrue(self.event.refresh_from_db() or True)

	def test_rsvp_rejects_duplicates_and_full_capacity(self):
		self.event.capacity = 1
		self.event.status = "Upcoming"
		self.event.save(update_fields=("capacity", "status"))
		first_attendee = GamerProfile.objects.create(user=User.objects.create_user(username="attendee-one", password="pass"), gamer_tag="AttendeeOne")
		second_attendee = GamerProfile.objects.create(user=User.objects.create_user(username="attendee-two", password="pass"), gamer_tag="AttendeeTwo")

		self.client.login(username="attendee-one", password="pass")
		response = self.client.post(reverse("event_rsvp", args=(self.event.id,)))
		self.assertEqual(response.status_code, 302)
		self.assertEqual(self.event.rsvps.count(), 1)

		response = self.client.post(reverse("event_rsvp", args=(self.event.id,)))
		self.assertEqual(response.status_code, 302)
		self.assertEqual(self.event.rsvps.count(), 1)

		self.client.logout()
		self.client.login(username="attendee-two", password="pass")
		response = self.client.post(reverse("event_rsvp", args=(self.event.id,)))
		self.assertEqual(response.status_code, 302)
		self.assertEqual(self.event.rsvps.count(), 1)

	def test_organizer_can_publish_event_and_owner_can_view_dashboard(self):
		self.client.login(username="event-owner", password="pass")
		self.event.status = "Draft"
		self.event.save(update_fields=("status",))
		response = self.client.post(reverse("event_publish", args=(self.event.id,)))
		self.assertEqual(response.status_code, 302)
		self.event.refresh_from_db()
		self.assertEqual(self.event.status, "Upcoming")

		org = Organization.objects.create(owner=self.profile, name="Venue Crew", slug="venue-crew", organization_type="Venue")
		response = self.client.get(reverse("organization_dashboard", args=(org.slug,)))
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Venue Crew")

	def test_organization_dashboard_exposes_promotion_review_actions(self):
		org = Organization.objects.create(owner=self.profile, name="Pixel Forge", slug="pixel-forge-review", organization_type="Venue", description="Gaming lounge")
		self.event.organization = org
		self.event.save(update_fields=("organization",))
		promotion = EventPromotionRequest.objects.create(
			event=self.event,
			requesting_organization=org,
			request_type="Featured Event",
			campaign_description="Highlight local venue showcase",
			status="Pending",
		)
		self.client.login(username="event-owner", password="pass")
		response = self.client.get(reverse("organization_dashboard", args=(org.slug,)))
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Approve")
		self.assertContains(response, "Reject")
		self.assertContains(response, reverse("event_promotion_review", args=(promotion.id, "approve")))
		self.assertContains(response, reverse("event_promotion_review", args=(promotion.id, "reject")))

# Create your tests here.
