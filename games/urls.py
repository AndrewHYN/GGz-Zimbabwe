from django.urls import path

from . import views


urlpatterns = [
	path("<int:game_id>/", views.game_detail, name="game_detail"),
    path("", views.game_list, name="game_list"),
]
