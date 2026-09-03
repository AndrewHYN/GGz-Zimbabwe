from django.urls import path

from . import views


urlpatterns = [
	path("signup/", views.signup, name="signup"),
	path("dashboard/", views.dashboard, name="dashboard"),
	path("discover/", views.geo_discovery, name="geo_discovery"),
	path("gamers/", views.gamer_discovery, name="gamer_discovery"),
	path("notifications/", views.notification_list, name="notification_list"),
	path("notifications/<int:notification_id>/read/", views.notification_read, name="notification_read"),
	path("notifications/<int:notification_id>/unread/", views.notification_unread, name="notification_unread"),
	path("notifications/read-all/", views.notifications_read_all, name="notifications_read_all"),
	path("messages/", views.conversation_list, name="conversation_list"),
	path("messages/requests/", views.message_requests, name="message_requests"),
	path("messages/<int:conversation_id>/", views.conversation_detail, name="conversation_detail"),
	path("messages/start/<str:gamer_tag>/", views.conversation_start, name="conversation_start"),
	path("messages/request/<str:gamer_tag>/<str:action>/", views.message_request_action, name="message_request_action"),
	path("<str:gamer_tag>/followers/", views.profile_followers, name="profile_followers"),
	path("<str:gamer_tag>/following/", views.profile_following, name="profile_following"),
	path("<str:gamer_tag>/friends/", views.profile_friends, name="profile_friends"),
	path("<str:gamer_tag>/match-history/", views.player_match_history, name="player_match_history"),
	path("<str:gamer_tag>/games/add/", views.profile_game_add, name="profile_game_add"),
	path("<str:gamer_tag>/games/<int:game_id>/remove/", views.profile_game_remove, name="profile_game_remove"),
	path("<str:gamer_tag>/edit/", views.profile_edit, name="profile_edit"),
	path("<str:gamer_tag>/<str:action>/", views.connection_action, name="connection_action"),
    path("<str:gamer_tag>/", views.profile_detail, name="profile_detail"),
]
