from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from games.models import Game

from .models import Block, Conversation, ConversationParticipant, Follow, FriendRequest, Friendship, GamerProfile, Message, MessageRequest, Notification, Post, PostLike, RespectTransaction, Venue
from events.models import Event, Organization
from teams.models import Team, TeamInvitation


class HealthAndConfigTests(TestCase):
	def test_health_check_endpoint_is_public_and_healthy(self):
		response = self.client.get(reverse("health_check"))
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()["status"], "ok")

	def test_homepage_loads_and_uses_ggz_branding(self):
		response = self.client.get(reverse("index"))
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "GGz")
		self.assertNotContains(response, "GGs")


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

	def test_dashboard_surfaces_key_member_workflows(self):
		self.client.login(username="tendai", password="strong-password-123")
		response = self.client.get(reverse("dashboard"))
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "My tournaments")
		self.assertContains(response, "Create tournament")
		self.assertContains(response, "My events")
		self.assertContains(response, "Create event")
		self.assertContains(response, "Team invitations")

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

	def test_profile_connection_pages_are_available(self):
		followed = self.profile
		follower = GamerProfile.objects.get(gamer_tag="RudoZW")
		Follow.objects.create(follower=follower, following=followed)
		response = self.client.get(reverse("profile_followers", args=[followed.gamer_tag]))
		self.assertContains(response, "RudoZW")
		self.assertContains(response, "Followers")
		response = self.client.get(reverse("profile_following", args=[follower.gamer_tag]))
		self.assertContains(response, "TendaiZW")
		self.assertContains(response, "Following")

	def test_message_requests_have_a_requests_dashboard(self):
		self.client.login(username="tendai", password="strong-password-123")
		self.client.post(reverse("message_request_action", args=["RudoZW", "send"]))
		self.client.logout()
		self.client.login(username="rudo", password="strong-password-123")
		response = self.client.get(reverse("message_requests"))
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "TendaiZW")
		self.assertContains(response, "Accept")

	def test_message_requests_dashboard_is_not_captured_by_profile_action_route(self):
		self.client.login(username="tendai", password="strong-password-123")
		response = self.client.get("/profiles/messages/requests/")
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Message requests")

	def test_geo_discovery_focuses_on_nearby_players_and_events(self):
		venue = Venue.objects.create(
			name="The Gamer Hub",
			city="Harare",
			province="Harare Metropolitan",
			country="Zimbabwe",
			latitude=-17.8252,
			longitude=31.0335,
		)
		nearby_profile = GamerProfile.objects.create(
			user=User.objects.create_user(username="nearby", password="strong-password-123"),
			gamer_tag="NearZW",
			location="Harare",
			city="Harare",
			province="Harare Metropolitan",
			country="Zimbabwe",
			latitude=-17.8245,
			longitude=31.0340,
		)
		Event.objects.create(
			organizer=self.profile,
			game=Game.objects.create(name="Valorant"),
			name="Harare Night Clash",
			description="Local LAN night.",
			start_date="2026-12-15T18:00:00Z",
			location="Harare",
			venue=venue,
			status="Upcoming",
		)

		response = self.client.get(reverse("geo_discovery"), {"lat": -17.8252, "lng": 31.0335, "radius": 30})
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "NearZW")
		self.assertContains(response, "Harare Night Clash")

	def test_geo_discovery_filters_by_game_platform_and_hides_private_profiles(self):
		nearby_game = Game.objects.create(name="Tekken 8")
		public_profile = GamerProfile.objects.create(
			user=User.objects.create_user(username="public1", password="strong-password-123"),
			gamer_tag="Public1ZW",
			city="Harare",
			country="Zimbabwe",
			platform="PC",
			availability="Available",
			rank="Platinum",
			latitude=-17.8230,
			longitude=31.0310,
			location_public=True,
		)
		public_profile.games.add(nearby_game)
		private_profile = GamerProfile.objects.create(
			user=User.objects.create_user(username="private1", password="strong-password-123"),
			gamer_tag="Private1ZW",
			city="Harare",
			country="Zimbabwe",
			platform="PC",
			availability="Available",
			latitude=-17.8230,
			longitude=31.0310,
			location_public=False,
		)
		private_profile.games.add(nearby_game)

		response = self.client.get(reverse("geo_discovery"), {"lat": -17.8252, "lng": 31.0335, "radius": 20, "game": nearby_game.id, "platform": "PC", "availability": "Available"})
		self.assertContains(response, "Public1ZW")
		self.assertNotContains(response, "Private1ZW")

	def test_venue_discovery_shows_public_business_details(self):
		venue = Venue.objects.create(
			name="Pixel Forge",
			category="Gaming Lounge",
			city="Harare",
			province="Harare Metropolitan",
			country="Zimbabwe",
			address="5 Samora Machel Ave",
			description="LAN nights and tournaments.",
			phone="+263771000000",
			website="https://example.com",
			social_link="https://instagram.com/pixelforge",
			opening_hours="10:00-22:00",
			latitude=-17.8240,
			longitude=31.0310,
		)
		response = self.client.get(reverse("geo_discovery"), {"lat": -17.8252, "lng": 31.0335, "radius": 20, "category": "Gaming Lounge"})
		self.assertContains(response, "Pixel Forge")
		self.assertContains(response, "Gaming Lounge")
		self.assertContains(response, "Samora Machel Ave")

	def test_nearby_offline_tournaments_are_in_discovery(self):
		tournament = self.profile.organized_tournaments.create(
			game=Game.objects.create(name="Street Fighter 6"),
			name="Harare Cup",
			slug="harare-cup",
			description="Local bracket.",
			format="1v1",
			start_date="2026-12-01T18:00:00Z",
			registration_deadline="2026-11-30T18:00:00Z",
			location="Harare",
			city="Harare",
			province="Harare Metropolitan",
			country="Zimbabwe",
			mode="offline",
			latitude=-17.8245,
			longitude=31.0340,
			status="Registration Open",
		)
		response = self.client.get(reverse("geo_discovery"), {"lat": -17.8252, "lng": 31.0335, "radius": 20, "tournament_mode": "offline"})
		self.assertContains(response, "Harare Cup")


class GGzMapTests(TestCase):
	def setUp(self):
		self.profile = GamerProfile.objects.create(
			user=User.objects.create_user(username="baselineplayer", password="pass"),
			gamer_tag="BaselinePlayer",
			city="Harare",
			country="Zimbabwe",
			latitude=-17.8252,
			longitude=31.0335,
			location_public=True,
		)

	def test_hotspot_api_aggregates_public_profiles_and_hides_private_details(self):
		base_game = Game.objects.create(name="Tekken 8")
		for i in range(3):
			profile = GamerProfile.objects.create(
				user=User.objects.create_user(username=f"hotspot{i}", password="pass"),
				gamer_tag=f"Hotspot{i}",
				city="Harare",
				country="Zimbabwe",
				latitude=-17.8244 + i * 0.0002,
				longitude=31.0322 + i * 0.0002,
				location_public=True,
			)
			profile.games.add(base_game)
		GamerProfile.objects.create(
			user=User.objects.create_user(username="secretplayer", password="pass"),
			gamer_tag="SecretPlayer",
			city="Harare",
			country="Zimbabwe",
			latitude=-17.8240,
			longitude=31.0320,
			location_public=False,
		)
		response = self.client.get(reverse("map_data"))
		self.assertEqual(response.status_code, 200)
		payload = response.json()
		self.assertGreaterEqual(len(payload["hotspots"]), 1)
		self.assertEqual(payload["hotspots"][0]["gamer_count"], 3)
		self.assertNotIn("username", str(payload["hotspots"]))
		self.assertNotIn("exact", str(payload["hotspots"]))
		self.assertNotIn("Hotspot0", str(payload["hotspots"]))

	def test_hotspot_threshold_and_empty_map_are_safe(self):
		Game.objects.create(name="Valorant")
		GamerProfile.objects.create(
			user=User.objects.create_user(username="solo", password="pass"),
			gamer_tag="SoloGuy",
			city="Bulawayo",
			country="Zimbabwe",
			latitude=-20.1830,
			longitude=28.5830,
			location_public=True,
		)
		with self.settings(GGZ_MAP_MIN_HOTSPOT_GAMERS=3):
			response = self.client.get(reverse("map_data"))
			self.assertEqual(response.status_code, 200)
			self.assertEqual(response.json()["hotspots"], [])
		response = self.client.get(reverse("map_data", args=[]))
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()["hotspots"], [])

	def test_public_entities_and_provider_fallback_are_included(self):
		venue = Venue.objects.create(
			name="Pixel Forge",
			category="Gaming Lounge",
			city="Harare",
			country="Zimbabwe",
			latitude=-17.8240,
			longitude=31.0310,
		)
		org = Organization.objects.create(
			owner=GamerProfile.objects.create(user=User.objects.create_user(username="orgowner", password="pass"), gamer_tag="OrgOwner"),
			name="North Star Esports",
			slug="north-star-esports",
			organization_type="Organization",
			description="Community organizer",
			latitude=-17.8230,
			longitude=31.0315,
			location_public=True,
		)
		Event.objects.create(
			organizer=GamerProfile.objects.create(user=User.objects.create_user(username="eventowner", password="pass"), gamer_tag="EventOwner"),
			name="Harare LAN Weekend",
			description="Public event",
			start_date="2026-12-15T18:00:00Z",
			status="Upcoming",
			location="Harare",
			latitude=-17.8235,
			longitude=31.0325,
		)
		self.profile.organized_tournaments.create(
			game=Game.objects.create(name="Street Fighter 6"),
			name="Harare Cup",
			slug="harare-cup-map",
			description="Local map tournament.",
			format="1v1",
			start_date="2026-12-01T18:00:00Z",
			registration_deadline="2026-11-30T18:00:00Z",
			location="Harare",
			city="Harare",
			country="Zimbabwe",
			mode="offline",
			latitude=-17.8228,
			longitude=31.0341,
			status="Registration Open",
		)
		response = self.client.get(reverse("map_data"))
		self.assertEqual(response.status_code, 200)
		payload = response.json()
		self.assertTrue(any(item["name"] == "Pixel Forge" for item in payload["venues"]))
		self.assertTrue(any(item["name"] == "Harare LAN Weekend" for item in payload["events"]))
		self.assertTrue(any(item["name"] == "Harare Cup" for item in payload["tournaments"]))
		self.assertTrue(any(item["name"] == "North Star Esports" for item in payload["organizations"]))

	def test_map_page_and_api_gracefully_handle_missing_provider_key(self):
		with self.settings(GGZ_MAP_PROVIDER="google", GGZ_MAP_API_KEY=""):
			response = self.client.get(reverse("map_page"))
			self.assertEqual(response.status_code, 200)
			self.assertContains(response, "GGz Map")
			api_response = self.client.get(reverse("map_data"))
			self.assertEqual(api_response.status_code, 200)
			self.assertIn("hotspots", api_response.json())


class GamerProfileGameTests(TestCase):
	def test_profile_games_are_visible_on_game_detail(self):
		user = User.objects.create_user(username="simba", password="pass-12345")
		profile = GamerProfile.objects.create(user=user, gamer_tag="SimbaZW")
		game = Game.objects.create(name="Rocket League")
		profile.games.add(game)

		response = self.client.get(reverse("game_detail", args=[game.id]))
		self.assertContains(response, "SimbaZW")

	def test_profile_detail_shows_competitive_stats_per_game(self):
		from tournaments.models import Tournament, TournamentMatch

		user = User.objects.create_user(username="champ", password="pass-12345")
		profile = GamerProfile.objects.create(user=user, gamer_tag="ChampZW")
		game = Game.objects.create(name="Street Fighter 6")
		profile.games.add(game)

		org_user = User.objects.create_user(username="org", password="pass")
		org_profile = GamerProfile.objects.create(user=org_user, gamer_tag="OrgZW")

		tournament = Tournament.objects.create(
			organizer=org_profile,
			game=game,
			name="Tournament",
			slug="tournament",
			description="Test",
			format="1v1",
			start_date="2026-12-15T18:00:00Z",
			registration_deadline="2026-12-14T18:00:00Z",
			status="Completed"
		)

		other_user = User.objects.create_user(username="other", password="pass")
		other_profile = GamerProfile.objects.create(user=other_user, gamer_tag="OtherZW")

		# Create match where profile wins
		TournamentMatch.objects.create(
			tournament=tournament, game=game, player_one=profile, player_two=other_profile, winner=profile, status="Completed"
		)

		response = self.client.get(reverse("profile_detail", args=[profile.gamer_tag]))
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Street Fighter 6")
		self.assertContains(response, "1")  # 1 win

	def test_player_match_history_page_renders_completed_matches(self):
		from tournaments.models import Tournament, TournamentMatch

		user = User.objects.create_user(username="historychamp", password="pass")
		profile = GamerProfile.objects.create(user=user, gamer_tag="HistoryChampZW")
		game = Game.objects.create(name="Tekken 8")
		profile.games.add(game)
		opponent_user = User.objects.create_user(username="opponent", password="pass")
		opponent = GamerProfile.objects.create(user=opponent_user, gamer_tag="OpponentZW")
		organizer_user = User.objects.create_user(username="historyorg", password="pass")
		organizer = GamerProfile.objects.create(user=organizer_user, gamer_tag="HistoryOrgZW")
		tournament = Tournament.objects.create(
			organizer=organizer,
			game=game,
			name="History Cup",
			slug="history-cup",
			description="Match history test",
			format="1v1",
			start_date="2026-12-15T18:00:00Z",
			registration_deadline="2026-12-14T18:00:00Z",
			status="Completed"
		)
		TournamentMatch.objects.create(
			tournament=tournament, game=game, player_one=profile, player_two=opponent,
			winner=profile, status="Completed", score="3-1"
		)
		TournamentMatch.objects.create(
			tournament=tournament, game=game, player_one=profile, player_two=opponent,
			winner=opponent, status="Scheduled", score="Pending"
		)

		response = self.client.get(reverse("player_match_history", args=[profile.gamer_tag]))
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "History Cup")
		self.assertContains(response, "3-1")
		self.assertContains(response, "Win")
		self.assertNotContains(response, "Pending")


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
		first, second = sorted((self.sender.id, self.recipient.id))
		Friendship.objects.create(profile_one_id=first, profile_two_id=second)
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
		self.client.login(username="recipient", password="pass")
		self.assertEqual(self.client.post(reverse("conversation_start", args=(self.sender.gamer_tag,))).status_code, 302)
		Block.objects.create(blocker=self.sender, blocked=self.recipient)
		self.client.login(username="sender", password="pass")
		self.assertEqual(self.client.post(start_url).status_code, 403)

	def test_blocked_users_cannot_follow_in_either_direction(self):
		Block.objects.create(blocker=self.recipient, blocked=self.sender)
		self.client.login(username="sender", password="pass")
		self.client.post(reverse("connection_action", args=(self.recipient.gamer_tag, "follow")))
		self.assertFalse(Follow.objects.exists())

	def test_blocked_profile_hides_social_actions_and_posts(self):
		post = Post.objects.create(author=self.recipient, body="Private post")
		Block.objects.create(blocker=self.sender, blocked=self.recipient)
		self.client.login(username="sender", password="pass")
		response = self.client.get(reverse("profile_detail", args=(self.recipient.gamer_tag,)))
		self.assertNotContains(response, "Give respect")
		self.assertNotContains(response, "Private post")

	def test_blocked_users_cannot_comment_on_visible_post(self):
		post = Post.objects.create(author=self.sender, body="Open post")
		Block.objects.create(blocker=self.sender, blocked=self.recipient)
		self.client.login(username="recipient", password="pass")
		self.client.post(reverse("post_detail", args=(post.id,)), {"body": "Not allowed"})
		self.assertFalse(post.comments.exists())


class SearchAndRankTests(TestCase):
	def test_authenticated_navbar_renders_player_menu(self):
		user = User.objects.create_user(username="navuser", password="strong-password-123")
		GamerProfile.objects.create(user=user, gamer_tag="NavPlayer", location="Harare")
		self.client.login(username="navuser", password="strong-password-123")
		response = self.client.get(reverse("index"))
		self.assertContains(response, 'id="nav-profile-toggle"')
		self.assertContains(response, 'aria-controls="nav-profile-panel"')
		self.assertContains(response, 'aria-haspopup="true"')
		self.assertContains(response, "Message requests")
		self.assertContains(response, "Log out")

	def test_logout_route_logs_user_out_and_redirects(self):
		user = User.objects.create_user(username="logoutuser", password="strong-password-123")
		GamerProfile.objects.create(user=user, gamer_tag="LogoutPlayer", location="Harare")
		self.client.login(username="logoutuser", password="strong-password-123")
		response = self.client.post(reverse("logout"))
		self.assertRedirects(response, "/accounts/login/")
		self.assertFalse(response.wsgi_request.user.is_authenticated)
		self.assertNotIn("_auth_user_id", self.client.session)

		logged_out_response = self.client.get(reverse("index"))
		self.assertContains(logged_out_response, "Log in")

	def test_navigation_dropdowns_render_accessible_triggers(self):
		response = self.client.get(reverse("index"))
		self.assertContains(response, 'class="nav-more"')
		self.assertContains(response, 'aria-haspopup="true"')
		self.assertContains(response, 'aria-expanded="false"')
		self.assertContains(response, "Community feed")
		self.assertContains(response, "Rankings")

	def test_search_categories_paginate_independently_and_preserve_query(self):
		for index in range(11):
			user = User.objects.create_user(username=f"search{index}")
			GamerProfile.objects.create(user=user, gamer_tag=f"Tekken{index}", rank="Gold")
		response = self.client.get(reverse("global_search"), {"q": "Tekken", "gamers_page": 2, "games_page": 4})
		self.assertContains(response, "Page 2 of 2")
		self.assertContains(response, "gamers_page=1")
		self.assertContains(response, "games_page=4")

	def test_discovery_cards_use_compact_scan_layout(self):
		GamerProfile.objects.create(user=User.objects.create_user(username="compactplayer"), gamer_tag="CompactPlayer", location="Harare", platform="PC", rank="Gold", availability="Available")
		response = self.client.get(reverse("gamer_discovery"))
		self.assertContains(response, 'class="gamer-card compact"')
		self.assertContains(response, 'View profile')
		self.assertContains(response, 'Search players')

	def test_leaderboard_uses_compact_rank_list(self):
		profile = GamerProfile.objects.create(user=User.objects.create_user(username="leaderboarduser"), gamer_tag="TopTier", respect_points=420)
		response = self.client.get(reverse("leaderboard"))
		self.assertContains(response, 'class="leaderboard-list page-section"')
		self.assertContains(response, f'href="/profiles/{profile.gamer_tag}/"')
		self.assertContains(response, 'Competitive stats')

	def test_rank_display_uses_model_choice_label(self):
		user = User.objects.create_user(username="ranked")
		profile = GamerProfile.objects.create(user=user, gamer_tag="Ranked", rank="Diamond")
		self.assertEqual(profile.get_rank_display(), "Diamond")
		self.assertContains(self.client.get(reverse("profile_detail", args=(profile.gamer_tag,))), "Diamond")

	def test_index_shows_live_community_hub_with_real_data(self):
		game = Game.objects.create(name="Apex Legends")
		profile = GamerProfile.objects.create(user=User.objects.create_user(username="pulseuser"), gamer_tag="PulseZW")
		Post.objects.create(author=profile, game=game, body="Looking for a few teammates this weekend.")
		self.client.get(reverse("index"))
		response = self.client.get(reverse("index"))
		self.assertContains(response, "Community pulse")
		self.assertContains(response, "Looking for a few teammates this weekend.")

	def test_index_uses_ggz_branding_on_homepage(self):
		response = self.client.get(reverse("index"))
		self.assertContains(response, "GGz")
		self.assertNotContains(response, "GGs")
