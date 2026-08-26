from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from games.models import Game

from .models import Follow, FriendRequest, Friendship, GamerProfile, Post, PostLike, RespectTransaction


class GamerProfileWorkflowTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			username="tendai",
			password="strong-password-123",
		)
		self.profile = GamerProfile.objects.create(
			user=self.user,
			gamer_tag="TendaiZW",
			location="Harare",
			platform="PC",
			rank="Gold",
			availability="Available",
		)
		self.other_user = User.objects.create_user(
			username="rudo",
			password="strong-password-123",
		)
		GamerProfile.objects.create(
			user=self.other_user,
			gamer_tag="RudoZW",
			location="Bulawayo",
			platform="Xbox",
			rank="Bronze",
		)

	def test_dashboard_requires_login(self):
		response = self.client.get(reverse("dashboard"))
		self.assertRedirects(response, "/accounts/login/?next=/profiles/dashboard/")

	def test_dashboard_shows_current_profile(self):
		self.client.login(username="tendai", password="strong-password-123")
		response = self.client.get(reverse("dashboard"))
		self.assertContains(response, "TendaiZW")
		self.assertContains(response, "Gamers to discover")

	def test_discovery_filters_by_location_and_platform(self):
		response = self.client.get(
			reverse("gamer_discovery"),
			{"location": "Bulawayo", "platform": "Xbox"},
		)
		self.assertContains(response, "RudoZW")
		self.assertNotContains(response, "TendaiZW")

	def test_profile_edit_is_limited_to_owner(self):
		self.client.login(username="rudo", password="strong-password-123")
		response = self.client.get(
			reverse("profile_edit", args=[self.profile.gamer_tag])
		)
		self.assertEqual(response.status_code, 403)

	def test_friend_request_can_be_accepted_and_removed(self):
		self.client.login(username="tendai", password="strong-password-123")
		self.client.post(
			reverse("connection_action", args=["RudoZW", "friend"])
		)
		self.assertEqual(FriendRequest.objects.count(), 1)

		self.client.logout()
		self.client.login(username="rudo", password="strong-password-123")
		self.client.post(
			reverse("connection_action", args=["TendaiZW", "accept"])
		)
		self.assertEqual(Friendship.objects.count(), 1)

		self.client.post(
			reverse("connection_action", args=["TendaiZW", "remove"])
		)
		self.assertFalse(Friendship.objects.exists())

	def test_follow_is_unique_and_self_follow_is_forbidden(self):
		self.client.login(username="tendai", password="strong-password-123")
		url = reverse("connection_action", args=["RudoZW", "follow"])
		self.client.post(url)
		self.client.post(url)
		self.assertEqual(Follow.objects.count(), 1)

		response = self.client.post(
			reverse("connection_action", args=["TendaiZW", "follow"])
		)
		self.assertEqual(response.status_code, 403)

	def test_signup_creates_user_and_profile(self):
		response = self.client.post(
			reverse("signup"),
			{
				"username": "nyasha",
				"email": "nyasha@example.com",
				"gamer_tag": "NyashaZW",
				"password1": "strong-password-123",
				"password2": "strong-password-123",
			},
		)
		self.assertRedirects(response, "/profiles/NyashaZW/")
		self.assertTrue(User.objects.filter(username="nyasha").exists())
		self.assertTrue(GamerProfile.objects.filter(gamer_tag="NyashaZW").exists())


class GamerProfileGameTests(TestCase):
	def test_profile_games_are_visible_on_game_detail(self):
		user = User.objects.create_user(username="simba", password="pass-12345")
		profile = GamerProfile.objects.create(user=user, gamer_tag="SimbaZW")
		game = Game.objects.create(name="Rocket League")
		profile.games.add(game)

		response = self.client.get(reverse("game_detail", args=[game.id]))
		self.assertContains(response, "SimbaZW")


class SocialPostTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			username="andrew", password="strong-password-123"
		)
		self.profile = GamerProfile.objects.create(user=self.user, gamer_tag="AndrewHYN")
		self.other_user = User.objects.create_user(
			username="chipo", password="strong-password-123"
		)
		self.other_profile = GamerProfile.objects.create(
			user=self.other_user, gamer_tag="ChipoZW"
		)
		self.game = Game.objects.create(name="Call of Duty")

	def test_authenticated_user_can_create_post_with_game(self):
		self.client.login(username="andrew", password="strong-password-123")
		response = self.client.post(
			reverse("post_create"),
			{"body": "Looking for two players tonight.", "game": self.game.id},
		)
		post = Post.objects.get()
		self.assertRedirects(response, reverse("feed"))
		self.assertEqual(post.author, self.profile)
		self.assertEqual(post.game, self.game)

	def test_post_edit_and_delete_require_author(self):
		post = Post.objects.create(author=self.profile, body="Original")
		self.client.login(username="chipo", password="strong-password-123")
		self.assertEqual(
			self.client.get(reverse("post_edit", args=[post.id])).status_code, 404
		)
		self.assertEqual(
			self.client.post(reverse("post_delete", args=[post.id])).status_code, 404
		)

	def test_like_toggles_without_duplicates(self):
		post = Post.objects.create(author=self.other_profile, body="Hello GGz")
		self.client.login(username="andrew", password="strong-password-123")
		url = reverse("post_like", args=[post.id])
		self.client.post(url)
		self.client.post(url)
		self.assertFalse(PostLike.objects.exists())

	def test_authenticated_user_can_comment(self):
		post = Post.objects.create(author=self.other_profile, body="Hello GGz")
		self.client.login(username="andrew", password="strong-password-123")
		response = self.client.post(
			reverse("post_detail", args=[post.id]), {"body": "Welcome!"}
		)
		self.assertRedirects(response, reverse("post_detail", args=[post.id]))
		self.assertEqual(post.comments.count(), 1)


class RespectTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(username="giver", password="strong-password-123")
		self.profile = GamerProfile.objects.create(user=self.user, gamer_tag="GiverZW")
		self.target = GamerProfile.objects.create(gamer_tag="TargetZW", user=User.objects.create_user(username="target"))

	def test_respect_is_granted_once_per_pair(self):
		self.client.login(username="giver", password="strong-password-123")
		url = reverse("connection_action", args=[self.target.gamer_tag, "respect"])
		self.client.post(url)
		self.client.post(url)
		self.target.refresh_from_db()
		self.assertEqual(self.target.respect_points, 1)
		self.assertEqual(RespectTransaction.objects.count(), 1)

	def test_respect_level_boundaries_are_dynamic(self):
		for score, level in ((0, "Rookie"), (50, "Player"), (200, "Pro"), (500, "Veteran"), (1000, "Elite"), (2500, "Legend")):
			self.profile.respect_points = score
			self.assertEqual(self.profile.respect_level, level)
