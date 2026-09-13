from django.urls import path

from . import views


urlpatterns = [
	path("signup/", views.signup, name="signup"),
	path("dashboard/", views.dashboard, name="dashboard"),
	path("security/", views.account_security, name="account_security"),
	path("gamers/", views.gamer_discovery, name="gamer_discovery"),
	path("gamers/suggestions/", views.gamer_suggestions, name="gamer_suggestions"),
	path("presence/heartbeat/", views.presence_heartbeat, name="presence_heartbeat"),
	path("presence/<str:gamer_tag>/stream/", views.presence_stream, name="presence_stream"),
	path("notifications/push/", views.push_subscription, name="push_subscription"),
	path("notifications/stream/", views.notification_stream, name="notification_stream"),
	path("messages/<int:conversation_id>/send/", views.conversation_send, name="conversation_send"),
	path("messages/<int:conversation_id>/typing/", views.conversation_typing, name="conversation_typing"),
	path("messages/<int:conversation_id>/stream/", views.conversation_stream, name="conversation_stream"),
	path("messages/stream/", views.conversation_inbox_stream, name="conversation_inbox_stream"),
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
