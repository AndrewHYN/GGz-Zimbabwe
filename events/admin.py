from django.contrib import admin

from .models import Event, EventRsvp, Organization, OrganizationLocation


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
	list_display = ("name", "organizer", "game", "status", "start_date", "city")
	list_filter = ("status", "mode", "featured", "game")
	search_fields = ("name", "city", "location", "organizer__gamer_tag")
	date_hierarchy = "start_date"
	list_select_related = ("organizer", "game")


@admin.register(EventRsvp)
class EventRsvpAdmin(admin.ModelAdmin):
	list_display = ("event", "attendee", "created_at")
	search_fields = ("event__name", "attendee__gamer_tag")


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
	list_display = ("name", "owner", "organization_type", "verification_status", "city", "created_at")
	list_filter = ("organization_type", "verification_status", "city")
	search_fields = ("name", "slug", "owner__gamer_tag", "city")
	list_select_related = ("owner",)


@admin.register(OrganizationLocation)
class OrganizationLocationAdmin(admin.ModelAdmin):
	list_display = ("name", "organization", "verification_status", "subscription_status", "featured", "city")
	list_filter = ("verification_status", "subscription_status", "featured", "public_visible")
	search_fields = ("name", "organization__name", "city")
	list_select_related = ("organization",)
