from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from games.models import Game

from .models import Block, Conversation, ConversationParticipant, Follow, FriendRequest, Friendship, GamerProfile, Message, MessageRequest, Notification, Post, PostLike, RespectTransaction


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
		self.assertContains(response, "Players to discover")

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


class NotificationAndMessagingTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(username="sender", password="pass")
		self.sender = GamerProfile.objects.create(user=self.user, gamer_tag="Sender")
		self.recipient_user = User.objects.create_user(username="recipient", password="pass")
		self.recipient = GamerProfile.objects.create(user=self.recipient_user, gamer_tag="Recipient")

	def test_notification_page_has_actor_and_mark_unread_workflow(self):
		notification = Notification.objects.create(recipient=self.recipient, actor=self.sender, notification_type="follow", message="Sender followed you", target_url="/profiles/Sender/")
		self.client.login(username="recipient", password="pass")
		self.assertContains(self.client.get(reverse("notification_list")), "Sender")
		self.assertEqual(self.client.get(reverse("notification_read", args=(notification.id,))).status_code, 403)
		self.client.post(reverse("notification_read", args=(notification.id,)))
		notification.refresh_from_db()
		self.assertTrue(notification.is_read)
		self.client.post(reverse("notification_unread", args=(notification.id,)))
		notification.refresh_from_db()
		self.assertFalse(notification.is_read)

	def test_message_creates_notification_and_clear_is_per_user(self):
		conversation = Conversation.objects.create()
		ConversationParticipant.objects.create(conversation=conversation, profile=self.sender)
		ConversationParticipant.objects.create(conversation=conversation, profile=self.recipient)
		self.client.login(username="sender", password="pass")
		self.client.post(reverse("conversation_detail", args=(conversation.id,)), {"body": "Hello"})
		self.assertTrue(Notification.objects.filter(recipient=self.recipient, notification_type="message").exists())
		self.client.login(username="recipient", password="pass")
		self.client.post(reverse("conversation_detail", args=(conversation.id,)), {"action": "clear"})
		self.assertContains(self.client.get(reverse("conversation_detail", args=(conversation.id,))), "No messages yet")
		self.assertTrue(Message.objects.exists())

	def test_message_requests_and_privacy_rules(self):
		self.client.login(username="sender", password="pass")
		start_url = reverse("conversation_start", args=(self.recipient.gamer_tag,))
		self.assertEqual(self.client.get(start_url).status_code, 403)
		self.assertEqual(self.client.post(start_url).status_code, 403)
		self.client.post(reverse("message_request_action", args=(self.recipient.gamer_tag, "send")))
		self.assertEqual(MessageRequest.objects.count(), 1)
		self.client.post(reverse("message_request_action", args=(self.recipient.gamer_tag, "send")))
		self.assertEqual(MessageRequest.objects.count(), 1)
		self.client.login(username="recipient", password="pass")
		self.client.post(reverse("message_request_action", args=(self.sender.gamer_tag, "accept")))
		self.client.login(username="sender", password="pass")
		self.assertEqual(self.client.post(start_url).status_code, 302)
		Block.objects.create(blocker=self.sender, blocked=self.recipient)
		self.assertEqual(self.client.post(start_url).status_code, 403)


class SearchAndRankTests(TestCase):
	def test_search_categories_paginate_independently_and_preserve_query(self):
		for index in range(11):
			user = User.objects.create_user(username=f"search{index}")
			GamerProfile.objects.create(user=user, gamer_tag=f"Tekken{index}", rank="Gold")
		response = self.client.get(reverse("global_search"), {"q": "Tekken", "gamers_page": 2, "games_page": 4})
		self.assertContains(response, "Page 2 of 2")
		self.assertContains(response, "gamers_page=1")
		self.assertContains(response, "games_page=4")

	def test_rank_display_uses_model_choice_label(self):
		user = User.objects.create_user(username="ranked")
		profile = GamerProfile.objects.create(user=user, gamer_tag="Ranked", rank="Diamond")
		self.assertEqual(profile.get_rank_display(), "Diamond")
		self.assertContains(self.client.get(reverse("profile_detail", args=(profile.gamer_tag,))), "Diamond")
