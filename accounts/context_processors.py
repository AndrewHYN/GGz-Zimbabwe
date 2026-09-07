from django.db.models import Exists, F, OuterRef, Q

from .models import ConversationParticipant, Message, MessageRequest


def _unread_message_count(profile):
    participant = ConversationParticipant.objects.filter(conversation_id=OuterRef("conversation_id"), profile=profile)
    return Message.objects.filter(conversation__participants=profile).exclude(sender=profile).filter(
        Exists(participant.filter(Q(cleared_at__isnull=True) | Q(cleared_at__lt=OuterRef("created_at"))))
    ).filter(
        Exists(participant.filter(Q(last_read_at__isnull=True) | Q(last_read_at__lt=OuterRef("created_at"))))
    ).count()


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