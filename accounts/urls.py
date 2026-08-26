from django.urls import path

from . import views


urlpatterns = [
	path("signup/", views.signup, name="signup"),
	path("dashboard/", views.dashboard, name="dashboard"),
	path("gamers/", views.gamer_discovery, name="gamer_discovery"),
	path("notifications/", views.notification_list, name="notification_list"),
	path("notifications/<int:notification_id>/read/", views.notification_read, name="notification_read"),
	path("notifications/read-all/", views.notifications_read_all, name="notifications_read_all"),
	path("messages/", views.conversation_list, name="conversation_list"),
	path("messages/<int:conversation_id>/", views.conversation_detail, name="conversation_detail"),
	path("messages/start/<str:gamer_tag>/", views.conversation_start, name="conversation_start"),
	path("<str:gamer_tag>/<str:action>/", views.connection_action, name="connection_action"),
	path("<str:gamer_tag>/edit/", views.profile_edit, name="profile_edit"),
    path("<str:gamer_tag>/", views.profile_detail, name="profile_detail"),
]
