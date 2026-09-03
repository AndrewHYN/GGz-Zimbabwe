from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse

from accounts.models import Block, GamerProfile, Report
from games.models import Game

from .models import Listing, SavedListing


class MarketplaceTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(username="seller", password="pass-12345")
		self.seller = GamerProfile.objects.create(user=self.user, gamer_tag="SellerZW", location="Harare")
		self.other_user = User.objects.create_user(username="buyer", password="pass-12345")
		self.buyer = GamerProfile.objects.create(user=self.other_user, gamer_tag="BuyerZW")
		self.game = Game.objects.create(name="Warzone")
		self.listing = Listing.objects.create(seller=self.seller, title="Gaming PC", description="RTX rig", category="Gaming PCs", price=850, condition="Good", location="Harare", game=self.game)

	def test_listing_detail_and_search_use_real_data(self):
		response = self.client.get(reverse("listing_list"), {"q": "RTX"})
		self.assertContains(response, "Gaming PC")
		self.assertContains(self.client.get(reverse("listing_detail", args=[self.listing.id])), "SellerZW")

	def test_owner_can_mark_sold_but_other_user_cannot_edit(self):
		self.client.login(username="buyer", password="pass-12345")
		self.assertEqual(self.client.get(reverse("listing_edit", args=[self.listing.id])).status_code, 404)
		self.client.logout()
		self.client.login(username="seller", password="pass-12345")
		self.client.post(reverse("listing_status", args=[self.listing.id, "Sold"]))
		self.listing.refresh_from_db()
		self.assertEqual(self.listing.status, "Sold")

	def test_saved_listing_is_unique_and_report_uses_shared_model(self):
		self.client.login(username="buyer", password="pass-12345")
		url = reverse("listing_save", args=[self.listing.id])
		self.client.post(url)
		self.client.post(url)
		self.assertFalse(SavedListing.objects.exists())
		self.client.post(reverse("listing_report", args=[self.listing.id]))
		self.assertTrue(Report.objects.filter(reported_listing_id=self.listing.id).exists())

	def test_blocked_buyer_cannot_contact_seller(self):
		Block.objects.create(blocker=self.buyer, blocked=self.seller)
		self.client.login(username="buyer", password="pass-12345")
		response = self.client.post(reverse("contact_seller", args=(self.listing.id,)))
		self.assertEqual(response.status_code, 403)

	def test_listing_image_save_writes_to_configured_storage(self):
		from .models import ListingImage

		listing_image = ListingImage.objects.create(
			listing=self.listing,
			image=SimpleUploadedFile("listing.jpg", b"listing-data"),
		)
		try:
			self.assertTrue(listing_image.image.storage.exists(listing_image.image.name))
		finally:
			listing_image.image.delete(save=False)
