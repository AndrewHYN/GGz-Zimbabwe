from django.contrib import admin

from .models import Game


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
	list_display = (
		"name",
		"genre",
		"developer",
		"free_to_play",
		"featured",
		"local_developer",
		"sponsored",
		"release_year",
	)
	list_filter = ("free_to_play", "featured", "local_developer", "sponsored", "genre")
	search_fields = (
		"name",
		"genre",
		"developer",
		"publisher",
		"steam_url",
		"epic_url",
	)
	readonly_fields = ("trailer_embed_url",)
