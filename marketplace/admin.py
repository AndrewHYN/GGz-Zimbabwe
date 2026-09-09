from django.contrib import admin

from .models import Listing, ListingImage, SavedListing


@admin.action(description="Mark selected listings as sold")
def mark_sold(modeladmin, request, queryset):
	queryset.update(status="Sold")


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
	list_display = ("title", "seller", "category", "price", "location", "status", "created_at")
	list_filter = ("category", "condition", "status", "platform")
	search_fields = ("title", "description", "location", "seller__gamer_tag")
	ordering = ("-created_at",)
	list_select_related = ("seller", "game")
	actions = (mark_sold,)


@admin.register(ListingImage)
class ListingImageAdmin(admin.ModelAdmin):
	list_display = ("listing", "created_at")


@admin.register(SavedListing)
class SavedListingAdmin(admin.ModelAdmin):
	list_display = ("user", "listing", "created_at")
	search_fields = ("user__gamer_tag", "listing__title")
