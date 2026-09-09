from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0020_message_client_id_conversationparticipant_typing_until"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="event_key",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="notification",
            name="seen_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddConstraint(
            model_name="notification",
            constraint=models.UniqueConstraint(
                condition=~Q(("event_key", "")),
                fields=("recipient", "event_key"),
                name="unique_notification_event_key",
            ),
        ),
    ]
