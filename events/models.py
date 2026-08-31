from django.db import models

from accounts.models import GamerProfile
from games.models import Game


class Organization(models.Model):
	ORGANIZATION_TYPES = [
		("Organization", "Organization"),
		("Brand", "Brand"),
		("Venue", "Venue"),
		("Team", "Team"),
		("Community", "Community"),
	]
	STATUS_CHOICES = [("Pending", "Pending"), ("Verified", "Verified"), ("Rejected", "Rejected")]

	owner = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="owned_organizations")
	name = models.CharField(max_length=160)
	slug = models.SlugField(unique=True, max_length=180)
	description = models.TextField(max_length=3000, blank=True)
	organization_type = models.CharField(max_length=30, choices=ORGANIZATION_TYPES, default="Organization")
	website = models.URLField(blank=True)
	social_link = models.URLField(blank=True)
	logo = models.ImageField(upload_to="organizations/logos/", blank=True, null=True)
	city = models.CharField(max_length=120, blank=True)
	province = models.CharField(max_length=120, blank=True)
	country = models.CharField(max_length=100, blank=True, default="Zimbabwe")
	address = models.CharField(max_length=255, blank=True)
	latitude = models.FloatField(blank=True, null=True)
	longitude = models.FloatField(blank=True, null=True)
	location_public = models.BooleanField(default=False)
	verification_status = models.CharField(max_length=15, choices=STATUS_CHOICES, default="Pending")
	contact_email = models.EmailField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ("name",)

	def __str__(self):
		return self.name


class Event(models.Model):
	STATUS_CHOICES = [("Draft", "Draft"), ("Published", "Published"), ("Upcoming", "Upcoming"), ("Live", "Live"), ("Completed", "Completed"), ("Cancelled", "Cancelled")]
	organizer = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="organized_events")
	organization = models.ForeignKey(Organization, on_delete=models.SET_NULL, null=True, blank=True, related_name="events")
	game = models.ForeignKey(Game, on_delete=models.SET_NULL, null=True, blank=True, related_name="events")
	name = models.CharField(max_length=160)
	description = models.TextField(max_length=3000)
	banner = models.ImageField(upload_to="events/", blank=True, null=True)
	start_date = models.DateTimeField()
	location = models.CharField(max_length=160, blank=True)
	city = models.CharField(max_length=120, blank=True)
	province = models.CharField(max_length=120, blank=True)
	country = models.CharField(max_length=100, blank=True, default="Zimbabwe")
	venue = models.ForeignKey("accounts.Venue", on_delete=models.SET_NULL, null=True, blank=True, related_name="events")
	latitude = models.FloatField(blank=True, null=True)
	longitude = models.FloatField(blank=True, null=True)
	location_public = models.BooleanField(default=True)
	mode = models.CharField(max_length=10, choices=(("online", "Online"), ("offline", "Offline")), default="offline")
	capacity = models.PositiveIntegerField(blank=True, null=True)
	status = models.CharField(max_length=15, choices=STATUS_CHOICES, default="Upcoming")
	featured = models.BooleanField(default=False)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ("start_date",)

	@property
	def attendee_count(self):
		return self.rsvps.count()


class EventPromotionRequest(models.Model):
	PROMO_TYPES = [
		("Featured Event", "Featured Event"),
		("Homepage Placement", "Homepage Placement"),
		("Tournament Sponsorship", "Tournament Sponsorship"),
		("Venue Promotion", "Venue Promotion"),
	]
	STATUS_CHOICES = [
		("Draft", "Draft"),
		("Submitted", "Submitted"),
		("Under Review", "Under Review"),
		("Pending", "Pending"),
		("Approved", "Approved"),
		("Active", "Active"),
		("Completed", "Completed"),
		("Rejected", "Rejected"),
		("Cancelled", "Cancelled"),
		("Expired", "Expired"),
	]

	event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="promotion_requests")
	requesting_organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="promotion_requests")
	request_type = models.CharField(max_length=30, choices=PROMO_TYPES, default="Featured Event")
	campaign_description = models.TextField(max_length=2000, blank=True)
	start_date = models.DateTimeField(blank=True, null=True)
	end_date = models.DateTimeField(blank=True, null=True)
	status = models.CharField(max_length=15, choices=STATUS_CHOICES, default="Pending")
	reviewer = models.ForeignKey(GamerProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_promotions")
	review_notes = models.TextField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ("-created_at",)

	def __str__(self):
		return f"{self.requesting_organization.name} -> {self.event.name}"


class EventRsvp(models.Model):
	event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="rsvps")
	attendee = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="event_rsvps")
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		constraints = [models.UniqueConstraint(fields=("event", "attendee"), name="unique_event_rsvp")]
