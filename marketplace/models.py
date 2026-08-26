from django.db import models

from accounts.models import GamerProfile
from games.models import Game


class Listing(models.Model):
	CATEGORY_CHOICES = [(value, value) for value in (
		"Gaming PCs", "Gaming Laptops", "PlayStation", "Xbox", "Nintendo",
		"PC Games", "Consoles", "Controllers", "GPUs", "CPUs", "Monitors",
		"Keyboards", "Mice", "Headsets", "Gaming Chairs", "Accessories", "Other",
	)]
	CONDITION_CHOICES = [(value, value) for value in ("New", "Like New", "Good", "Fair", "Used")]
	STATUS_CHOICES = [(value, value) for value in ("Available", "Reserved", "Sold")]

	seller = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="listings")
	title = models.CharField(max_length=160)
	description = models.TextField(max_length=3000)
	category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
	price = models.DecimalField(max_digits=12, decimal_places=2)
	condition = models.CharField(max_length=20, choices=CONDITION_CHOICES)
	location = models.CharField(max_length=100)
	game = models.ForeignKey(Game, on_delete=models.SET_NULL, null=True, blank=True, related_name="listings")
	platform = models.CharField(max_length=100, blank=True)
	status = models.CharField(max_length=15, choices=STATUS_CHOICES, default="Available")
	created_at = models.DateTimeField(auto_now_add=True, db_index=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ("-created_at",)
		indexes = [models.Index(fields=("status", "category")), models.Index(fields=("location",))]

	def __str__(self):
		return self.title


class ListingImage(models.Model):
	listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="images")
	image = models.ImageField(upload_to="listings/")
	created_at = models.DateTimeField(auto_now_add=True)


class SavedListing(models.Model):
	user = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="saved_listings")
	listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="saves")
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		constraints = [models.UniqueConstraint(fields=("user", "listing"), name="unique_saved_listing")]
