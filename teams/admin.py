from django.contrib import admin

from .models import Team, TeamInvitation, TeamMembership


@admin.action(description="Archive selected teams")
def archive_teams(modeladmin, request, queryset):
	queryset.update(status="Archived")


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
	list_display = ("name", "tag", "owner", "game", "status", "location", "created_at")
	list_filter = ("status", "game", "location")
	search_fields = ("name", "tag", "owner__gamer_tag", "location")
	list_select_related = ("owner", "game")
	actions = (archive_teams,)


@admin.register(TeamMembership)
class TeamMembershipAdmin(admin.ModelAdmin):
	list_display = ("team", "player", "role", "joined_at")
	list_filter = ("role", "team__game")
	search_fields = ("team__name", "player__gamer_tag")
	list_select_related = ("team", "player")


@admin.register(TeamInvitation)
class TeamInvitationAdmin(admin.ModelAdmin):
	list_display = ("team", "inviter", "invitee", "status", "created_at")
	list_filter = ("status", "team__game")
	search_fields = ("team__name", "inviter__gamer_tag", "invitee__gamer_tag")
	list_select_related = ("team", "inviter", "invitee")
