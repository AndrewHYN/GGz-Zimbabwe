from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from PIL import Image

from accounts.models import Block, GamerProfile
from events.models import Organization, OrganizationLocation


def image_upload():
    buffer = BytesIO()
    Image.new("RGB", (3, 3)).save(buffer, format="PNG")
    return SimpleUploadedFile("fixture.png", buffer.getvalue(), content_type="image/png")


class InvestorMVPTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(username="pilot-owner", password="test-password")
        cls.player = User.objects.create_user(username="pilot-player", password="test-password")
        GamerProfile.objects.create(user=cls.owner, gamer_tag="pilot-owner")
        GamerProfile.objects.create(user=cls.player, gamer_tag="pilot-player")
        cls.organization = Organization.objects.create(
            owner=cls.owner.gamer_profile, name="Pilot Gaming Club", slug="pilot-club", city="Private office",
        )
        cls.public_venue = OrganizationLocation.objects.create(
            organization=cls.organization, name="Harare Arcade", city="Harare",
            latitude=-17.83, longitude=31.05, public_visible=True,
        )
        cls.private_venue = OrganizationLocation.objects.create(
            organization=cls.organization, name="Hidden Warehouse",
            latitude=-17.86, longitude=31.02, public_visible=False,
        )

    def test_org_directory_search_and_radar_only_publish_visible_venues(self):
        matches = self.client.get("/api/organizations/", {"q": "Harare"}).json()
        self.assertEqual([item["slug"] for item in matches], ["pilot-club"])
        self.assertEqual(matches[0]["location"], "")
        self.assertEqual(self.client.get("/api/organizations/", {"q": "Hidden Warehouse"}).json(), [])
        detail = self.client.get("/api/organizations/pilot-club/").json()
        self.assertEqual([item["id"] for item in detail["venues"]], [self.public_venue.id])
        self.assertNotIn("Hidden Warehouse", str(detail))
        search = self.client.get("/api/search/", {"q": "Harare"}).json()
        self.assertEqual([item["slug"] for item in search["organizations"]], ["pilot-club"])
        radar = self.client.get("/api/radar/map/", {"q": "Harare"}).json()
        self.assertEqual([item["id"] for item in radar["locations"]], [self.public_venue.id])
        self.assertEqual(radar["locations"][0]["organization_url"], "/organizations/pilot-club/")

    def test_player_search_hides_private_location_and_blocks(self):
        profile = self.player.gamer_profile
        profile.location_public = False
        profile.location = "Private street"
        profile.city = "Private city"
        profile.save()
        tag = profile.gamer_tag
        results = self.client.get("/api/search/", {"q": tag}).json()
        self.assertEqual(results["gamers"][0]["location"], "Location hidden")
        detail = self.client.get(f"/api/profiles/detail/{tag}/").json()
        self.assertEqual(detail["city"], "")

        Block.objects.create(blocker=self.owner.gamer_profile, blocked=profile)
        self.client.force_login(self.owner)
        self.assertNotIn(tag, [item["gamer_tag"] for item in self.client.get("/api/profiles/gamers/").json()])
        self.assertEqual(self.client.get("/api/search/", {"q": tag}).json()["gamers"], [])

    def test_owner_can_upload_avatar_and_cover_and_guest_can_read_them(self):
        profile = self.owner.gamer_profile
        path = f"/api/profiles/{profile.gamer_tag}/media/"
        self.assertEqual(self.client.post(path, {"avatar": image_upload()}).status_code, 401)
        self.client.force_login(self.player)
        self.assertEqual(self.client.post(path, {"avatar": image_upload()}).status_code, 403)
        self.client.force_login(self.owner)
        invalid = SimpleUploadedFile("fixture.png", b"invalid", content_type="image/png")
        self.assertEqual(self.client.post(path, {"avatar": invalid}).status_code, 400)
        with TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media, DEPLOYED=False):
            avatar = self.client.post(path, {"avatar": image_upload()})
            self.assertEqual(avatar.status_code, 200)
            cover = self.client.post(path, {"cover": image_upload()})
            self.assertEqual(cover.status_code, 200)
            guest = Client()
            public_profile = guest.get(f"/api/profiles/detail/{profile.gamer_tag}/").json()
            self.assertEqual(public_profile["avatar"], avatar.json()["avatar"])
            self.assertEqual(public_profile["cover"], cover.json()["cover"])
            for field in ("avatar", "cover"):
                self.assertEqual(guest.get(public_profile[field]).status_code, 200)
        csrf_client = Client(enforce_csrf_checks=True)
        csrf_client.force_login(self.owner)
        self.assertEqual(csrf_client.post(path, {"avatar": image_upload()}).status_code, 403)

    def test_readiness_rejects_pending_migrations_while_liveness_passes(self):
        self.assertEqual(self.client.get("/api/ready/").status_code, 200)
        with patch("hello_world.core.views.MigrationExecutor") as executor:
            executor.return_value.migration_plan.return_value = [object()]
            self.assertEqual(self.client.get("/health/").status_code, 200)
            self.assertEqual(self.client.get("/api/ready/").status_code, 503)
