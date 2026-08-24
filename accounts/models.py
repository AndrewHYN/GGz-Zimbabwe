# Create your models here.
from django.contrib.auth.models import User
from django.db import models


class GamerProfile(models.Model):
    PLATFORM_CHOICES = [
        ("PC", "PC"),
        ("PlayStation", "PlayStation"),
        ("Xbox", "Xbox"),
        ("Nintendo", "Nintendo"),
        ("Mobile", "Mobile"),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="gamer_profile"
    )

    gamer_tag = models.CharField(max_length=50, unique=True)
    bio = models.TextField(blank=True)
    location = models.CharField(max_length=100, blank=True)

    platform = models.CharField(
        max_length=20,
        choices=PLATFORM_CHOICES,
        blank=True
    )

    respect_points = models.PositiveIntegerField(default=0)
    tournament_wins = models.PositiveIntegerField(default=0)

    youtube = models.URLField(blank=True)
    social_link = models.URLField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.gamer_tag