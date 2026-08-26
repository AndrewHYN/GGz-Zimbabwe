from django.db.models import F, Q

from .models import Message


def notification_count(request):
    if not request.user.is_authenticated:
        return {"unread_notification_count": 0, "unread_message_count": 0, "user_profile": None}
    profile = getattr(request.user, "gamer_profile", None)
    if not profile:
        return {"unread_notification_count": 0, "unread_message_count": 0, "user_profile": None}
    unread_messages = Message.objects.filter(conversation__participant_links__profile=profile).exclude(sender=profile).filter(Q(conversation__participant_links__last_read_at__isnull=True) | Q(conversation__participant_links__last_read_at__lt=F("created_at"))).count()
    return {"unread_notification_count": profile.notifications.filter(is_read=False).count(), "unread_message_count": unread_messages, "user_profile": profile}