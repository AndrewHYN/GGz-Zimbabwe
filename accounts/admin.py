from django.contrib import admin
from .models import GamerProfile


@admin.register(GamerProfile)
class GamerProfileAdmin(admin.ModelAdmin):
    list_display = (
        "gamer_tag",
        "location",
        "platform",
        "respect_points",
        "tournament_wins",
    )

    search_fields = (
        "gamer_tag",
        "location",
        "user__username",
    )