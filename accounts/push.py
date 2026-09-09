import json
import logging

from django.conf import settings

from .models import PushSubscription

logger = logging.getLogger(__name__)


def send_notification(profile, message, target_url="", notification_type="activity"):
	if not all((settings.VAPID_PUBLIC_KEY, settings.VAPID_PRIVATE_KEY, settings.VAPID_SUBJECT)):
		return 0
	try:
		from pywebpush import WebPushException, webpush
	except ImportError:
		logger.warning("Web Push is configured but the pywebpush dependency is unavailable.")
		return 0
	payload = {
		"title": "GGz activity",
		"body": message,
		"url": target_url or "/profiles/notifications/",
		"type": notification_type,
	}
	sent = 0
	for subscription in profile.user.push_subscriptions.all():
		subscription_info = {
			"endpoint": subscription.endpoint,
			"keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
		}
		try:
			webpush(
				subscription_info=subscription_info,
				data=json.dumps(payload),
				vapid_private_key=settings.VAPID_PRIVATE_KEY,
				vapid_claims={"sub": settings.VAPID_SUBJECT},
			)
			sent += 1
		except WebPushException as error:
			status_code = getattr(getattr(error, "response", None), "status_code", None)
			if status_code in {404, 410}:
				subscription.delete()
			else:
				logger.warning("Web Push delivery failed for a subscription.")
	return sent