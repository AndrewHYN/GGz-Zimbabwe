from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0016_externalfeeditem"),
        ("tournaments", "0004_tournament_city_tournament_country_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="TournamentInvitation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("Pending", "Pending"), ("Accepted", "Accepted"), ("Declined", "Declined")], default="Pending", max_length=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("responded_at", models.DateTimeField(blank=True, null=True)),
                ("player", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="tournament_invitations", to="accounts.gamerprofile")),
                ("tournament", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="invitations", to="tournaments.tournament")),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.AddConstraint(
            model_name="tournamentinvitation",
            constraint=models.UniqueConstraint(fields=("tournament", "player"), name="unique_tournament_invitation"),
        ),
    ]