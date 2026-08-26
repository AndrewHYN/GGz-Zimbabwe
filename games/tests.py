from django.test import TestCase
from django.urls import reverse

from accounts.models import GamerProfile, Post
from django.contrib.auth.models import User

from .models import Game


class GameHubTests(TestCase):
	def test_game_list_is_alphabetical(self):
		Game.objects.create(name="Valorant")
		Game.objects.create(name="Apex Legends")

		response = self.client.get(reverse("game_list"))

		self.assertContains(response, "Apex Legends")
		self.assertContains(response, "Valorant")
		self.assertLess(
			response.content.index(b"Apex Legends"),
			response.content.index(b"Valorant"),
		)

	def test_game_detail_displays_metadata(self):
		game = Game.objects.create(
			name="EA FC",
			player_count=22,
			popularity=80,
			release_year=2025,
		)

		response = self.client.get(reverse("game_detail", args=[game.id]))

		self.assertContains(response, "2025")
		self.assertContains(response, "22")

	def test_game_detail_shows_only_related_posts(self):
		user = User.objects.create_user(username="gamer")
		profile = GamerProfile.objects.create(user=user, gamer_tag="GamerZW")
		game = Game.objects.create(name="Tekken 8")
		other_game = Game.objects.create(name="Street Fighter 6")
		Post.objects.create(author=profile, game=game, body="Tekken community post")
		Post.objects.create(author=profile, game=other_game, body="Street Fighter post")

		response = self.client.get(reverse("game_detail", args=[game.id]))

		self.assertContains(response, "Tekken community post")
		self.assertNotContains(response, "Street Fighter post")
