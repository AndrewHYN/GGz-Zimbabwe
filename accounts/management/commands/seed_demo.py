import base64
import os
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from accounts.models import (
    Comment,
    Conversation,
    ConversationParticipant,
    Follow,
    Friendship,
    GamerProfile,
    Message,
    Notification,
    Post,
    PostLike,
    Venue,
)
from events.models import Event, Organization, OrganizationLocation
from games.models import Game, GameReview, GameWishlist
from marketplace.models import Listing, ListingImage
from teams.models import Team, TeamMembership
from tournaments.models import Challenge, Tournament, TournamentMatch, TournamentRegistration


DEMO_PASSWORD = os.environ.get("GGZ_DEMO_PASSWORD", "ggz-demo-password-change-me")
PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
    "+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


class Command(BaseCommand):
    help = "Create or update deterministic, relational GGz demo data."

    @transaction.atomic
    def handle(self, *args, **options):
        users = self._users()
        profiles = self._profiles(users)
        games = self._games()
        for profile, game_names in ((profiles["organizer"], ("Valorant", "EA FC 25")), (profiles["player"], ("Valorant", "Tekken 8")), (profiles["casual"], ("Stardew Valley", "EA FC 25")), (profiles["seller"], ("Tekken 8",))):
            profile.games.set([games[name] for name in game_names])

        first, second = sorted((profiles["organizer"].id, profiles["player"].id))
        Friendship.objects.get_or_create(profile_one_id=first, profile_two_id=second)
        Follow.objects.get_or_create(follower=profiles["casual"], following=profiles["player"])
        Follow.objects.get_or_create(follower=profiles["player"], following=profiles["casual"])

        venue = Venue.objects.get_or_create(
            name="GGz Demo Arena",
            defaults={"category": "Gaming Hub", "city": "Harare", "country": "Zimbabwe", "address": "12 Samora Machel Avenue", "latitude": -17.8252, "longitude": 31.0335},
        )[0]
        posts = self._posts(profiles, games)
        self._social_content(profiles, posts)
        organization = self._organization(profiles["organizer"], venue)
        team = Team.objects.get_or_create(
            slug="ggz-demo-squad",
            defaults={"owner": profiles["organizer"], "game": games["Valorant"], "name": "GGz Demo Squad", "tag": "GGZ", "description": "A seeded competitive demo team.", "location": "Harare"},
        )[0]
        TeamMembership.objects.get_or_create(team=team, player=profiles["organizer"], defaults={"role": "Captain"})
        TeamMembership.objects.get_or_create(team=team, player=profiles["player"], defaults={"role": "Member"})

        tournament = self._tournament(profiles["organizer"], games["Valorant"], venue)
        for profile in profiles.values():
            if profile in (profiles["organizer"], profiles["player"], profiles["casual"]):
                TournamentRegistration.objects.get_or_create(tournament=tournament, player=profile, defaults={"status": "Registered"})
        self._bracket(tournament, games["Valorant"], profiles)
        Challenge.objects.get_or_create(challenger=profiles["player"], opponent=profiles["organizer"], game=games["Valorant"], defaults={"tournament": tournament, "status": "Pending", "scheduled_at": timezone.now() + timedelta(days=2)})

        Event.objects.get_or_create(
            name="GGz Harare Community Night",
            defaults={"organizer": profiles["organizer"], "organization": organization, "game": games["EA FC 25"], "description": "A seeded community gaming night.", "start_date": timezone.now() + timedelta(days=14), "location": "GGz Demo Arena", "city": "Harare", "country": "Zimbabwe", "venue": venue, "latitude": venue.latitude, "longitude": venue.longitude, "mode": "offline", "status": "Upcoming", "capacity": 64},
        )
        listing = Listing.objects.get_or_create(
            title="Demo Tekken 8 Fight Stick",
            defaults={"seller": profiles["seller"], "description": "A seeded marketplace listing for the demo environment.", "category": "Gaming Accessories", "price": "120.00", "condition": "Good", "location": "Harare", "game": games["Tekken 8"], "platform": "PC", "status": "Available"},
        )[0]
        listing_image = ListingImage.objects.filter(listing=listing).first()
        if listing_image is None:
            listing_image = ListingImage(listing=listing)
            self._image(ListingImage, listing_image, "image", "demo-listing.png", "listings")
        self._messages_and_notifications(profiles)
        self.stdout.write(self.style.SUCCESS("GGz demo data seeded idempotently."))

    def _users(self):
        specs = {
            "organizer": ("demo_organizer", "organizer@demo.ggz.local", True),
            "player": ("demo_player", "player@demo.ggz.local", False),
            "casual": ("demo_casual", "casual@demo.ggz.local", False),
            "seller": ("demo_seller", "seller@demo.ggz.local", False),
        }
        users = {}
        for key, (username, email, staff) in specs.items():
            user, created = User.objects.get_or_create(username=username, defaults={"email": email, "is_staff": staff})
            if created:
                user.set_password(DEMO_PASSWORD)
                user.save(update_fields=("password",))
            elif staff and not user.is_staff:
                user.is_staff = True
                user.save(update_fields=("is_staff",))
            users[key] = user
        return users

    def _profiles(self, users):
        specs = {
            "organizer": ("DemoOrganizer", "Tournament organizer demo profile", "Platinum", "Available", "PC", "Harare"),
            "player": ("DemoPlayer", "Competitive player demo profile", "Gold", "Available", "PC", "Bulawayo"),
            "casual": ("DemoCasual", "Casual gamer demo profile", "Silver", "Sometimes", "PlayStation", "Mutare"),
            "seller": ("DemoSeller", "Marketplace seller demo profile", "Bronze", "Busy", "Xbox", "Harare"),
        }
        profiles = {}
        for key, (tag, bio, rank, availability, platform, city) in specs.items():
            profile, _ = GamerProfile.objects.get_or_create(user=users[key], defaults={"gamer_tag": tag})
            profile.bio = bio
            profile.rank = rank
            profile.availability = availability
            profile.platform = platform
            profile.city = city
            profile.country = "Zimbabwe"
            profile.location_public = True
            profile.save()
            self._image(GamerProfile, profile, "avatar", f"demo-{key}.png", "avatars")
            profiles[key] = profile
        return profiles

    def _games(self):
        specs = {
            "Valorant": ("FPS", "Competitive tactical shooter", "https://www.youtube.com/watch?v=e_E9W2vsRbQ"),
            "Tekken 8": ("Fighting", "Modern fighting game", "https://www.youtube.com/watch?v=Bo7uS7dQOwM"),
            "EA FC 25": ("Sports", "Football simulation", "https://www.youtube.com/watch?v=pBM2xyco_Kg"),
            "Stardew Valley": ("Adventure", "Relaxing farming adventure", "https://www.youtube.com/watch?v=ot7uXNQskhs"),
        }
        games = {}
        for name, (genre, description, trailer_url) in specs.items():
            game, _ = Game.objects.get_or_create(name=name, defaults={"genre": genre})
            game.genre = genre
            game.description = description
            game.platform = "PC, Console"
            game.popularity = 80
            game.featured = name in ("Valorant", "Tekken 8")
            game.trailer_url = trailer_url
            game.save()
            games[name] = game
        return games

    def _posts(self, profiles, games):
        post, _ = Post.objects.get_or_create(author=profiles["player"], body="Ready for the GGz demo tournament!", defaults={"game": games["Valorant"]})
        post.game = games["Valorant"]
        post.save(update_fields=("game",))
        review, _ = GameReview.objects.get_or_create(game=games["Tekken 8"], reviewer=profiles["casual"], defaults={"rating": 5, "review": "A great demo review."})
        review.rating = 5
        review.review = "A great demo review."
        review.save(update_fields=("rating", "review"))
        GameWishlist.objects.get_or_create(game=games["Tekken 8"], profile=profiles["player"])
        return [post]

    def _social_content(self, profiles, posts):
        PostLike.objects.get_or_create(post=posts[0], user=profiles["casual"])
        Comment.objects.get_or_create(post=posts[0], author=profiles["casual"], defaults={"body": "Count me in!"})

    def _organization(self, owner, venue):
        organization, _ = Organization.objects.get_or_create(slug="ggz-demo-community", defaults={"owner": owner, "name": "GGz Demo Community", "organization_type": "Community", "description": "A seeded GGz organization.", "city": "Harare", "country": "Zimbabwe", "address": venue.address, "latitude": venue.latitude, "longitude": venue.longitude, "location_public": True, "verification_status": "Verified"})
        OrganizationLocation.objects.get_or_create(organization=organization, name="GGz Demo Arena", defaults={"location_type": "Gaming Hub", "address": venue.address, "city": "Harare", "country": "Zimbabwe", "latitude": venue.latitude, "longitude": venue.longitude, "public_visible": True, "verification_status": "VERIFIED"})
        return organization

    def _tournament(self, organizer, game, venue):
        tournament, _ = Tournament.objects.get_or_create(slug="ggz-demo-valorant-cup", defaults={"organizer": organizer, "game": game, "name": "GGz Demo Valorant Cup", "description": "A seeded tournament.", "format": "1v1", "max_participants": 8, "start_date": timezone.now() + timedelta(days=7), "registration_deadline": timezone.now() + timedelta(days=5), "location": venue.name, "city": "Harare", "country": "Zimbabwe", "venue": venue, "mode": "offline", "status": "Registration Open", "prize_description": "GGz demo trophy"})
        self._image(Tournament, tournament, "banner", "demo-tournament.png", "tournaments")
        return tournament

    def _bracket(self, tournament, game, profiles):
        if TournamentMatch.objects.filter(tournament=tournament).exists():
            return
        first = TournamentMatch.objects.create(tournament=tournament, game=game, player_one=profiles["organizer"], player_two=profiles["player"], round=1)
        second = TournamentMatch.objects.create(tournament=tournament, game=game, player_one=profiles["casual"], round=1, status="Completed", winner=profiles["casual"], score="Bye")
        TournamentMatch.objects.create(tournament=tournament, game=game, round=2, next_match=None)
        first.next_match = TournamentMatch.objects.filter(tournament=tournament, round=2).first()
        first.save(update_fields=("next_match",))
        second.next_match = first.next_match
        second.save(update_fields=("next_match",))

    def _messages_and_notifications(self, profiles):
        conversation, _ = Conversation.objects.get_or_create()
        ConversationParticipant.objects.get_or_create(conversation=conversation, profile=profiles["organizer"])
        ConversationParticipant.objects.get_or_create(conversation=conversation, profile=profiles["player"])
        if not Message.objects.filter(conversation=conversation).exists():
            Message.objects.create(conversation=conversation, sender=profiles["organizer"], body="Welcome to the GGz demo.")
        Notification.objects.get_or_create(recipient=profiles["player"], actor=profiles["organizer"], notification_type="tournament", message="You have a new GGz demo tournament update", defaults={"target_url": "/tournaments/ggz-demo-valorant-cup/"})

    def _image(self, model, instance, field_name, filename, directory):
        field = getattr(instance, field_name)
        if not field:
            field.save(filename, ContentFile(PNG_BYTES), save=True)
