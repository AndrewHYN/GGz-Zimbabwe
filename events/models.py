from django.core.exceptions import ValidationError
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

	@property
	def is_public(self):
		return bool(self.location_public)

	@property
	def total_locations(self):
		return self.locations.count()


class OrganizationLocation(models.Model):
	VERIFICATION_CHOICES = [
		("UNVERIFIED", "Unverified"),
		("VERIFIED", "Verified"),
		("SUSPENDED", "Suspended"),
		("INACTIVE", "Inactive"),
	]
	SUBSCRIPTION_CHOICES = [
		("FREE", "Free"),
		("RADAR", "Radar"),
		("FEATURED", "Featured"),
	]
	LOCATION_TYPES = [
		("Gaming Hub", "Gaming Hub"),
		("Esports Arena", "Esports Arena"),
		("LAN Centre", "LAN Centre"),
		("Gaming Café", "Gaming Café"),
		("PC Shop", "PC Shop"),
		("Developer Studio", "Developer Studio"),
		("Tech Business", "Tech Business"),
		("Gaming Club", "Gaming Club"),
	]

	organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="locations")
	name = models.CharField(max_length=180)
	location_type = models.CharField(max_length=40, choices=LOCATION_TYPES, default="Gaming Hub")
	latitude = models.FloatField(blank=True, null=True)
	longitude = models.FloatField(blank=True, null=True)
	address = models.CharField(max_length=255, blank=True)
	city = models.CharField(max_length=120, blank=True)
	country = models.CharField(max_length=100, blank=True, default="Zimbabwe")
	description = models.TextField(blank=True)
	phone = models.CharField(max_length=30, blank=True)
	website = models.URLField(blank=True)
	social_links = models.JSONField(default=list, blank=True)
	opening_hours = models.CharField(max_length=250, blank=True)
	games = models.ManyToManyField("games.Game", blank=True, related_name="radar_locations")
	amenities = models.JSONField(default=list, blank=True)
	photos = models.JSONField(default=list, blank=True)
	verification_status = models.CharField(max_length=20, choices=VERIFICATION_CHOICES, default="UNVERIFIED")
	subscription_status = models.CharField(max_length=20, choices=SUBSCRIPTION_CHOICES, default="FREE")
	featured = models.BooleanField(default=False)
	public_visible = models.BooleanField(default=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ("name",)
		indexes = [models.Index(fields=("verification_status", "public_visible")), models.Index(fields=("city", "country"))]

	def __str__(self):
		return self.name

	@property
	def is_verified(self):
		return self.verification_status == "VERIFIED"

	@property
	def is_public(self):
		return bool(self.public_visible)

	@property
	def rating_count(self):
		return self.ratings.count()

	@property
	def average_rating(self):
		ratings = list(self.ratings.values_list("value", flat=True))
		if not ratings:
			return None
		return round(sum(ratings) / len(ratings), 1)

	@property
	def ggz_score(self):
		base = 0.0
		if self.average_rating is not None:
			base += self.average_rating * 1.8
		if self.rating_count:
			base += min(self.rating_count * 0.6, 6.0)
		if self.is_verified:
			base += 2.0
		if self.subscription_status == "FEATURED":
			base += 1.5
		if self.featured:
			base += 1.0
		if self.games.exists():
			base += 0.5
		return round(min(base, 10.0), 1)

	def clean(self):
		if self.latitude is not None and not (-90 <= self.latitude <= 90):
			raise ValidationError({"latitude": "Latitude must be between -90 and 90 degrees."})
		if self.longitude is not None and not (-180 <= self.longitude <= 180):
			raise ValidationError({"longitude": "Longitude must be between -180 and 180 degrees."})
		if self.public_visible and not self.name.strip():
			raise ValidationError({"name": "A public Radar location requires a name."})

	def save(self, *args, **kwargs):
		self.full_clean()
		super().save(*args, **kwargs)


class OrganizationLocationRating(models.Model):
	location = models.ForeignKey(OrganizationLocation, on_delete=models.CASCADE, related_name="ratings")
	user = models.ForeignKey("auth.User", on_delete=models.CASCADE, related_name="radar_location_ratings")
	value = models.PositiveSmallIntegerField(default=0)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		constraints = [models.UniqueConstraint(fields=("location", "user"), name="unique_radar_location_rating")]

	def clean(self):
		if not 1 <= self.value <= 5:
			raise ValidationError({"value": "Rating value must be between 1 and 5."})

	def save(self, *args, **kwargs):
		self.full_clean()
		super().save(*args, **kwargs)


class OrganizationLocationReview(models.Model):
	location = models.ForeignKey(OrganizationLocation, on_delete=models.CASCADE, related_name="reviews")
	author = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="radar_location_reviews")
	rating = models.PositiveSmallIntegerField(default=5)
	review_text = models.TextField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ("-created_at",)

	def clean(self):
		if not 1 <= self.rating <= 5:
			raise ValidationError({"rating": "Review rating must be between 1 and 5."})
		if not self.review_text or not self.review_text.strip():
			raise ValidationError({"review_text": "Review text cannot be blank."})

	def save(self, *args, **kwargs):
		self.full_clean()
		super().save(*args, **kwargs)


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
