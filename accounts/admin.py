from django.contrib import admin
from .models import Block, Comment, Conversation, ConversationParticipant, ExternalFeedItem, Follow, FriendRequest, Friendship, GamerProfile, Message, Notification, Post, PostLike, PostSave, Report, RespectTransaction, Venue


@admin.register(Venue)
class VenueAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "city", "phone", "website")
    search_fields = ("name", "city", "address", "category")


@admin.register(GamerProfile)
class GamerProfileAdmin(admin.ModelAdmin):
    list_display = (
        "gamer_tag",
        "location",
        "platform",
        "respect_points",
        "tournament_wins",
    )

    search_fields = (
        "gamer_tag",
        "location",
        "user__username",
    )


@admin.register(FriendRequest)
class FriendRequestAdmin(admin.ModelAdmin):
    list_display = ("sender", "receiver", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("sender__gamer_tag", "receiver__gamer_tag")


@admin.register(Friendship)
class FriendshipAdmin(admin.ModelAdmin):
    list_display = ("profile_one", "profile_two", "created_at")
    search_fields = ("profile_one__gamer_tag", "profile_two__gamer_tag")


@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ("follower", "following", "created_at")
    search_fields = ("follower__gamer_tag", "following__gamer_tag")


@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display = ("blocker", "blocked", "created_at")
    search_fields = ("blocker__gamer_tag", "blocked__gamer_tag")


@admin.register(ExternalFeedItem)
class ExternalFeedItemAdmin(admin.ModelAdmin):
    list_display = ("title", "source_name", "game", "content_type", "published_at", "is_active")
    list_filter = ("content_type", "is_active", "game")
    search_fields = ("title", "source_name", "game__name")
    ordering = ("-published_at",)


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("author", "game", "created_at")
    list_filter = ("game", "created_at")
    search_fields = ("author__gamer_tag", "body")
    ordering = ("-created_at",)


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("author", "post", "created_at")
    search_fields = ("author__gamer_tag", "body")


@admin.register(PostLike)
class PostLikeAdmin(admin.ModelAdmin):
    list_display = ("user", "post", "created_at")
    search_fields = ("user__gamer_tag",)


@admin.register(PostSave)
class PostSaveAdmin(admin.ModelAdmin):
    list_display = ("user", "post", "created_at")
    search_fields = ("user__gamer_tag",)


@admin.register(RespectTransaction)
class RespectTransactionAdmin(admin.ModelAdmin):
    list_display = ("giver", "recipient", "created_at")
    search_fields = ("giver__gamer_tag", "recipient__gamer_tag")


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("reporter", "reported_profile", "post", "reported_listing_id", "reason", "created_at")
    list_filter = ("reason", "created_at")
    search_fields = ("reporter__gamer_tag", "reported_profile__gamer_tag", "details")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("recipient", "actor", "notification_type", "is_read", "created_at")
    list_filter = ("notification_type", "is_read")
    search_fields = ("recipient__gamer_tag", "message")


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "updated_at")


@admin.register(ConversationParticipant)
class ConversationParticipantAdmin(admin.ModelAdmin):
    list_display = ("conversation", "profile", "last_read_at")


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("conversation", "sender", "created_at")
    search_fields = ("sender__gamer_tag", "body")