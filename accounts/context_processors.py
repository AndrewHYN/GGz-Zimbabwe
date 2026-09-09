import hashlib
import random

from django.conf import settings
from django.core.cache import cache
from django.db.models import Exists, F, OuterRef, Q

from games.models import Game

from .models import ConversationParticipant, Message, MessageRequest


def _unread_message_count(profile):
    participant = ConversationParticipant.objects.filter(conversation_id=OuterRef("conversation_id"), profile=profile)
    return Message.objects.filter(conversation__participants=profile).exclude(sender=profile).filter(
        Exists(participant.filter(Q(cleared_at__isnull=True) | Q(cleared_at__lt=OuterRef("created_at"))))
    ).filter(
        Exists(participant.filter(Q(last_read_at__isnull=True) | Q(last_read_at__lt=OuterRef("created_at"))))
    ).count()


def notification_count(request):
    path = request.path.rstrip("/") or "/"
    ambient_enabled = not path.startswith("/admin") and not path.startswith("/static")
    ambient_media = []
    if ambient_enabled:
        pool = cache.get("ggz_ambient_game_media")
        if pool is None:
            pool = list(Game.objects.filter(Q(cover_art_url__startswith="http://") | Q(cover_art_url__startswith="https://")).order_by("-featured", "-popularity", "name").values_list("cover_art_url", flat=True)[:12])
            cache.set("ggz_ambient_game_media", pool, 900)
        if pool:
            seed = int(hashlib.sha256(f"{path}:{request.META.get('HTTP_USER_AGENT', '')}".encode("utf-8")).hexdigest(), 16)
            generator = random.Random(seed)
            ambient_media = generator.sample(pool, min(3, len(pool)))
    push_context = {"VAPID_PUBLIC_KEY": getattr(settings, "VAPID_PUBLIC_KEY", ""), "ambient_media": ambient_media, "ambient_enabled": ambient_enabled}
    if not request.user.is_authenticated:
        return {**push_context, "unread_notification_count": 0, "unread_message_count": 0, "pending_message_request_count": 0, "user_profile": None}
    profile = getattr(request.user, "gamer_profile", None)
    if not profile:
        return {**push_context, "unread_notification_count": 0, "unread_message_count": 0, "pending_message_request_count": 0, "user_profile": None}
    pending_message_requests = MessageRequest.objects.filter(recipient=profile, status="Pending").count()
    return {
        **push_context,
        "unread_notification_count": profile.notifications.filter(is_read=False).count(),
        "unread_message_count": _unread_message_count(profile),
        "pending_message_request_count": pending_message_requests,
        "user_profile": profile,
    }