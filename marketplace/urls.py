from django.urls import path

from . import views

urlpatterns = [
    path("", views.listing_list, name="listing_list"),
    path("create/", views.listing_create, name="listing_create"),
    path("my-listings/", views.my_listings, name="my_listings"),
    path("saved/", views.saved_listings, name="saved_listings"),
    path("listing/<int:listing_id>/", views.listing_detail, name="listing_detail"),
    path("listing/<int:listing_id>/edit/", views.listing_edit, name="listing_edit"),
    path("listing/<int:listing_id>/delete/", views.listing_delete, name="listing_delete"),
    path("listing/<int:listing_id>/status/<str:status>/", views.listing_status, name="listing_status"),
    path("listing/<int:listing_id>/save/", views.listing_save, name="listing_save"),
    path("listing/<int:listing_id>/report/", views.listing_report, name="listing_report"),
    path("listing/<int:listing_id>/contact/", views.contact_seller, name="contact_seller"),
]
