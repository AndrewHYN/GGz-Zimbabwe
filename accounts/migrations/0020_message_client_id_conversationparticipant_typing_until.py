from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0019_message_delivered_at_message_read_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="conversationparticipant",
            name="typing_until",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="message",
            name="client_id",
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddConstraint(
            model_name="message",
            constraint=models.UniqueConstraint(
                condition=Q(("client_id__isnull", False)),
                fields=("conversation", "client_id"),
                name="unique_message_client_id",
            ),
        ),
    ]
