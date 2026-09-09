from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0021_notification_seen_at_event_key"),
    ]

    operations = [
        migrations.AddField(
            model_name="messagerequest",
            name="context_label",
            field=models.CharField(blank=True, max_length=160),
        ),
        migrations.AddField(
            model_name="messagerequest",
            name="context_url",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]