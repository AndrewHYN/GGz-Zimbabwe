from django.contrib import admin

from .models import Challenge, Tournament, TournamentInvitation, TournamentMatch, TournamentRegistration


@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
	list_display = ("name", "game", "organizer", "start_date", "status", "mode")
	list_filter = ("status", "mode", "format", "game")
	search_fields = ("name", "description", "organizer__gamer_tag")
	prepopulated_fields = {"slug": ("name",)}


@admin.register(TournamentRegistration)
class TournamentRegistrationAdmin(admin.ModelAdmin):
	list_display = ("tournament", "player", "status", "joined_at")
	list_filter = ("status",)
	search_fields = ("tournament__name", "player__gamer_tag")


@admin.register(TournamentInvitation)
class TournamentInvitationAdmin(admin.ModelAdmin):
	list_display = ("tournament", "player", "status", "created_at", "responded_at")
	list_filter = ("status",)
	search_fields = ("tournament__name", "player__gamer_tag")


@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
	list_display = ("challenger", "opponent", "game", "status", "created_at")
	list_filter = ("status", "game")


@admin.register(TournamentMatch)
class TournamentMatchAdmin(admin.ModelAdmin):
	list_display = ("tournament", "player_one", "player_two", "status", "winner")
	list_filter = ("status", "tournament")
