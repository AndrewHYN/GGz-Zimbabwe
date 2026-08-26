# Create your models here.
from django.contrib.auth.models import User
from django.db import models
from django.db.models import Q


class GamerProfile(models.Model):
    PLATFORM_CHOICES = [
        ("PC", "PC"),
        ("PlayStation", "PlayStation"),
        ("Xbox", "Xbox"),
        ("Nintendo", "Nintendo"),
        ("Mobile", "Mobile"),
    ]
    RANK_CHOICES = [
        ("Unranked", "Unranked"),
        ("Bronze", "Bronze"),
        ("Silver", "Silver"),
        ("Gold", "Gold"),
        ("Platinum", "Platinum"),
        ("Diamond", "Diamond"),
        ("Master", "Master"),
    ]
    AVAILABILITY_CHOICES = [
        ("Available", "Available to play"),
        ("Sometimes", "Sometimes available"),
        ("Busy", "Usually busy"),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="gamer_profile"
    )

    gamer_tag = models.CharField(max_length=50, unique=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    bio = models.TextField(blank=True)
    location = models.CharField(max_length=100, blank=True)

    platform = models.CharField(
        max_length=20,
        choices=PLATFORM_CHOICES,
        blank=True
    )
    rank = models.CharField(
        max_length=20,
        choices=RANK_CHOICES,
        default="Unranked",
    )
    availability = models.CharField(
        max_length=20,
        choices=AVAILABILITY_CHOICES,
        default="Sometimes",
    )

    games = models.ManyToManyField(
        "games.Game",
        blank=True,
        related_name="players",
    )

    respect_points = models.PositiveIntegerField(default=0)
    tournament_wins = models.PositiveIntegerField(default=0)

    youtube = models.URLField(blank=True)
    social_link = models.URLField(blank=True)
    discord_username = models.CharField(max_length=100, blank=True)
    playstation_username = models.CharField(max_length=100, blank=True)
    xbox_username = models.CharField(max_length=100, blank=True)
    steam_username = models.CharField(max_length=100, blank=True)
    riot_username = models.CharField(max_length=100, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.gamer_tag

    @property
    def respect_level(self):
        if self.respect_points >= 2500:
            return "Legend"
        if self.respect_points >= 1000:
            return "Elite"
        if self.respect_points >= 500:
            return "Veteran"
        if self.respect_points >= 200:
            return "Pro"
        if self.respect_points >= 50:
            return "Player"
        return "Rookie"

    @property
    def matches_played(self):
        from tournaments.models import TournamentMatch
        return TournamentMatch.objects.filter(Q(player_one=self) | Q(player_two=self), status="Completed").count()

    @property
    def match_wins(self):
        from tournaments.models import TournamentMatch
        return self.matches_won.filter(status="Completed").count()

    @property
    def match_losses(self):
        return self.matches_played - self.match_wins

    @property
    def win_percentage(self):
        return round(self.match_wins / self.matches_played * 100, 1) if self.matches_played else 0

    def delete(self, *args, **kwargs):
        avatar = self.avatar
        result = super().delete(*args, **kwargs)
        if avatar:
            avatar.delete(save=False)
        return result


class FriendRequest(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("rejected", "Rejected"),
        ("cancelled", "Cancelled"),
    ]

    sender = models.ForeignKey(
        GamerProfile, on_delete=models.CASCADE, related_name="sent_friend_requests"
    )
    receiver = models.ForeignKey(
        GamerProfile, on_delete=models.CASCADE, related_name="received_friend_requests"
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("sender", "receiver"), name="unique_friend_request"
            ),
            models.CheckConstraint(
                condition=~Q(sender=models.F("receiver")), name="no_self_friend_request"
            ),
        ]
        ordering = ("-created_at",)


class Friendship(models.Model):
    profile_one = models.ForeignKey(
        GamerProfile, on_delete=models.CASCADE, related_name="friendships_as_one"
    )
    profile_two = models.ForeignKey(
        GamerProfile, on_delete=models.CASCADE, related_name="friendships_as_two"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("profile_one", "profile_two"), name="unique_friendship"
            ),
            models.CheckConstraint(
                condition=models.Q(profile_one__lt=models.F("profile_two")),
                name="friendship_profiles_are_ordered",
            ),
        ]


class Follow(models.Model):
    follower = models.ForeignKey(
        GamerProfile, on_delete=models.CASCADE, related_name="following"
    )
    following = models.ForeignKey(
        GamerProfile, on_delete=models.CASCADE, related_name="followers"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("follower", "following"), name="unique_follow"
            ),
            models.CheckConstraint(
                condition=~Q(follower=models.F("following")), name="no_self_follow"
            ),
        ]
        ordering = ("-created_at",)


class Block(models.Model):
    blocker = models.ForeignKey(
        GamerProfile, on_delete=models.CASCADE, related_name="blocks_created"
    )
    blocked = models.ForeignKey(
        GamerProfile, on_delete=models.CASCADE, related_name="blocked_by"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("blocker", "blocked"), name="unique_block"
            ),
            models.CheckConstraint(
                condition=~Q(blocker=models.F("blocked")), name="no_self_block"
            ),
        ]


class Post(models.Model):
    author = models.ForeignKey(
        GamerProfile, on_delete=models.CASCADE, related_name="posts"
    )
    game = models.ForeignKey(
        "games.Game", on_delete=models.SET_NULL, blank=True, null=True, related_name="posts"
    )
    body = models.TextField(max_length=2000)
    image = models.ImageField(upload_to="posts/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.author.gamer_tag}: {self.body[:40]}"


class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        GamerProfile, on_delete=models.CASCADE, related_name="comments"
    )
    body = models.TextField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)


class PostLike(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="post_likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("post", "user"), name="unique_post_like")
        ]


class RespectTransaction(models.Model):
    giver = models.ForeignKey(
        GamerProfile, on_delete=models.CASCADE, related_name="respect_given"
    )
    recipient = models.ForeignKey(
        GamerProfile, on_delete=models.CASCADE, related_name="respect_received"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("giver", "recipient"), name="unique_respect_transaction"
            ),
            models.CheckConstraint(
                condition=~Q(giver=models.F("recipient")), name="no_self_respect"
            ),
        ]
        ordering = ("-created_at",)


class Report(models.Model):
    REASON_CHOICES = [
        ("spam", "Spam"),
        ("harassment", "Harassment"),
        ("scam", "Scam"),
        ("inappropriate", "Inappropriate content"),
        ("other", "Other"),
    ]

    reporter = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="reports_made")
    reported_profile = models.ForeignKey(
        GamerProfile, on_delete=models.CASCADE, blank=True, null=True, related_name="reports_received"
    )
    post = models.ForeignKey(Post, on_delete=models.CASCADE, blank=True, null=True, related_name="reports")
    reported_listing_id = models.PositiveBigIntegerField(blank=True, null=True)
    reason = models.CharField(max_length=20, choices=REASON_CHOICES, default="other")
    details = models.TextField(blank=True, max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(Q(reported_profile__isnull=False) & Q(post__isnull=True) & Q(reported_listing_id__isnull=True))
                | (Q(reported_profile__isnull=True) & Q(post__isnull=False) & Q(reported_listing_id__isnull=True))
                | (Q(reported_profile__isnull=True) & Q(post__isnull=True) & Q(reported_listing_id__isnull=False)),
                name="report_has_one_target",
            ),
            models.UniqueConstraint(
                fields=("reporter", "reported_profile"), name="unique_profile_report"
            ),
            models.UniqueConstraint(fields=("reporter", "post"), name="unique_post_report"),
            models.UniqueConstraint(fields=("reporter", "reported_listing_id"), name="unique_listing_report"),
        ]
        ordering = ("-created_at",)


class Notification(models.Model):
    recipient = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="notifications")
    actor = models.ForeignKey(GamerProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications_triggered")
    notification_type = models.CharField(max_length=40)
    message = models.CharField(max_length=255)
    target_url = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-created_at",)


class Conversation(models.Model):
    participants = models.ManyToManyField(GamerProfile, through="ConversationParticipant", related_name="conversations")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class ConversationParticipant(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="participant_links")
    profile = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="conversation_links")
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("conversation", "profile"), name="unique_conversation_participant")]


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(GamerProfile, on_delete=models.CASCADE, related_name="messages_sent")
    body = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("created_at",)