from django.db.models import F, Q

from .models import Message, MessageRequest


def _unread_message_count(profile):
    unread_messages = Message.objects.filter(
        conversation__participant_links__profile=profile,
    ).exclude(sender=profile).filter(
        Q(conversation__participant_links__cleared_at__isnull=True)
        | Q(conversation__participant_links__cleared_at__lt=F("created_at"))
    ).filter(
        Q(conversation__participant_links__last_read_at__isnull=True)
        | Q(conversation__participant_links__last_read_at__lt=F("created_at"))
    ).distinct()
    return unread_messages.count()


def notification_count(request):
    if not request.user.is_authenticated:
        return {"unread_notification_count": 0, "unread_message_count": 0, "pending_message_request_count": 0, "user_profile": None}
    profile = getattr(request.user, "gamer_profile", None)
    if not profile:
        return {"unread_notification_count": 0, "unread_message_count": 0, "pending_message_request_count": 0, "user_profile": None}
    pending_message_requests = MessageRequest.objects.filter(recipient=profile, status="Pending").count()
    return {
        "unread_notification_count": profile.notifications.filter(is_read=False).count(),
        "unread_message_count": _unread_message_count(profile),
        "pending_message_request_count": pending_message_requests,
        "user_profile": profile,
    }