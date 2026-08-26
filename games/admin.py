from django.contrib import admin

from .models import Game


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
	list_display = (
		"name",
		"cover_art_url",
		"genre",
		"developer",
		"publisher",
		"platform",
		"player_count",
		"popularity",
		"release_year",
	)

	search_fields = (
		"name",
		"genre",
		"developer",
		"publisher",
	)
