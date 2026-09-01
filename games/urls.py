from django.urls import path

from . import views


urlpatterns = [
	path("<int:game_id>/leaderboard/", views.game_leaderboard, name="game_leaderboard"),
	path("<int:game_id>/challenge/", views.game_challenge_create, name="game_challenge_create"),
	path("<int:game_id>/review/", views.game_review_create, name="game_review_create"),
	path("<int:game_id>/wishlist/", views.game_wishlist_toggle, name="game_wishlist_toggle"),
	path("<int:game_id>/", views.game_detail, name="game_detail"),
    path("", views.game_list, name="game_list"),
]
