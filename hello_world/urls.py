"""
URL configuration for hello_world project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from accounts import views as account_views
from tournaments import views as tournament_views
from events import views as event_views
from hello_world.core import views as core_views

urlpatterns = [
    path("", core_views.index),
    path("leaderboards/", core_views.leaderboard, name="leaderboard"),
    path("search/", core_views.global_search, name="global_search"),
    path("admin/", admin.site.urls),
    path("profiles/", include("accounts.urls")),
    path("games/", include("games.urls")),
    path("marketplace/", include("marketplace.urls")),
    path("teams/", include("teams.urls")),
    path("events/", event_views.event_list, name="event_list"),
    path("events/create/", event_views.event_create, name="event_create"),
    path("events/<int:event_id>/", event_views.event_detail, name="event_detail"),
    path("events/<int:event_id>/rsvp/", event_views.event_rsvp, name="event_rsvp"),
    path("events/<int:event_id>/leave/", event_views.event_leave, name="event_leave"),
    path("events/<int:event_id>/edit/", event_views.event_edit, name="event_edit"),
    path("events/<int:event_id>/cancel/", event_views.event_cancel, name="event_cancel"),
    path("tournaments/", tournament_views.tournament_list, name="tournament_list"),
    path("tournaments/create/", tournament_views.tournament_create, name="tournament_create"),
    path("tournaments/my/", tournament_views.tournament_my, name="tournament_my"),
    path("tournaments/<slug:slug>/edit/", tournament_views.tournament_edit, name="tournament_edit"),
    path("tournaments/<slug:slug>/manage/", tournament_views.tournament_manage, name="tournament_manage"),
    path("tournaments/<slug:slug>/generate-bracket/", tournament_views.generate_bracket, name="generate_bracket"),
    path("tournaments/registrations/<int:registration_id>/<str:action>/", tournament_views.registration_action, name="registration_action"),
    path("tournaments/<slug:slug>/", tournament_views.tournament_detail, name="tournament_detail"),
    path("tournaments/<slug:slug>/register/", tournament_views.tournament_register, name="tournament_register"),
    path("tournaments/<slug:slug>/leave/", tournament_views.tournament_leave, name="tournament_leave"),
    path("tournaments/<slug:slug>/challenge/", tournament_views.challenge_create, name="challenge_create"),
    path("tournaments/<slug:slug>/matches/create/", tournament_views.match_create, name="match_create"),
    path("tournaments/challenges/<int:challenge_id>/<str:action>/", tournament_views.challenge_action, name="challenge_action"),
    path("tournaments/matches/<int:match_id>/result/", tournament_views.match_result, name="match_result"),
    path("feed/", account_views.feed, name="feed"),
    path("notifications/", account_views.notification_list, name="notification_list"),
    path("notifications/<int:notification_id>/read/", account_views.notification_read, name="notification_read"),
    path("notifications/read-all/", account_views.notifications_read_all, name="notifications_read_all"),
    path("messages/", account_views.conversation_list, name="conversation_list"),
    path("messages/<int:conversation_id>/", account_views.conversation_detail, name="conversation_detail"),
    path("messages/start/<str:gamer_tag>/", account_views.conversation_start, name="conversation_start"),
    path("feed/create/", account_views.post_create, name="post_create"),
    path("feed/posts/<int:post_id>/", account_views.post_detail, name="post_detail"),
    path("feed/posts/<int:post_id>/edit/", account_views.post_edit, name="post_edit"),
    path("feed/posts/<int:post_id>/delete/", account_views.post_delete, name="post_delete"),
    path("feed/posts/<int:post_id>/like/", account_views.post_like, name="post_like"),
    path("feed/posts/<int:post_id>/report/", account_views.post_report, name="post_report"),
    path("accounts/", include("django.contrib.auth.urls")),
    path("__reload__/", include("django_browser_reload.urls")),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
