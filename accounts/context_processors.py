def notification_count(request):
    if not request.user.is_authenticated:
        return {"unread_notification_count": 0}
    profile = getattr(request.user, "gamer_profile", None)
    return {"unread_notification_count": profile.notifications.filter(is_read=False).count() if profile else 0}