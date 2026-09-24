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

import re

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from accounts import views as account_views
from tournaments import views as tournament_views
from events import views as event_views
from hello_world.core import views as core_views
from hello_world.core import api as api_views
from hello_world.core import auth_api as auth_api_views

urlpatterns = [
    path("", core_views.index, name="index"),
    path("health/", core_views.health_check, name="health_check"),
    path("service-worker.js", core_views.service_worker, name="service_worker"),
    path("leaderboards/", core_views.leaderboard, name="leaderboard"),
    path("search/", core_views.global_search, name="global_search"),
    path("assistant/", core_views.ai_companion, name="ai_companion"),
    path("privacy/", core_views.privacy, name="privacy"),
    path("cookies/", core_views.cookie_policy, name="cookie_policy"),
    path("refund/", core_views.refund_policy, name="refund_policy"),
    path("terms/", core_views.terms, name="terms"),
    path("admin/overview/", core_views.admin_dashboard, name="admin_dashboard"),
    path("discover/", account_views.geo_discovery, name="geo_discovery"),
    path("map/", account_views.map_page, name="map_page"),
    path("map-data/", account_views.map_data, name="map_data"),
    path("radar/locations/<int:location_id>/", account_views.radar_location_detail, name="radar_location_detail"),
    path("radar/locations/<int:location_id>/rate/", account_views.radar_location_rating_create, name="radar_location_rating_create"),
    path("radar/locations/<int:location_id>/reviews/create/", account_views.radar_location_review_create, name="radar_location_review_create"),
    path("radar/locations/<int:location_id>/reviews/<int:review_id>/delete/", account_views.radar_location_review_delete, name="radar_location_review_delete"),
    # Next.js frontend API endpoints
    path("api/csrf/", api_views.api_csrf_token, name="api_csrf_token"),
    path("api/me/", api_views.api_me, name="api_me"),
    path("api/auth/login/", auth_api_views.api_auth_login, name="api_auth_login"),
    path("api/auth/logout/", auth_api_views.api_auth_logout, name="api_auth_logout"),
    path("api/auth/register/", auth_api_views.api_auth_register, name="api_auth_register"),
    path("api/auth/password-reset/", auth_api_views.api_auth_password_reset, name="api_auth_password_reset"),
    path("api/auth/password-reset/confirm/", auth_api_views.api_auth_password_reset_confirm, name="api_auth_password_reset_confirm"),
    path("api/auth/password-change/", auth_api_views.api_auth_password_change, name="api_auth_password_change"),
    path("api/auth/unlink/<str:provider>/", auth_api_views.api_auth_unlink, name="api_auth_unlink"),
    path("api/auth/providers/", auth_api_views.api_auth_providers, name="api_auth_providers"),
    path("api/games/", api_views.api_games_list, name="api_games_list"),
    path("api/games/<int:game_id>/", api_views.api_game_detail, name="api_game_detail"),
    path("api/games/<int:game_id>/reviews/", api_views.api_game_review_create, name="api_game_review_create"),
    path("api/games/<int:game_id>/wishlist/", api_views.api_game_wishlist_toggle, name="api_game_wishlist_toggle"),
    path("api/games/<int:game_id>/challenge/", api_views.api_game_challenge_create, name="api_game_challenge_create"),
    path("api/tournaments/", api_views.api_tournaments_list, name="api_tournaments_list"),
    path("api/events/", api_views.api_events_list, name="api_events_list"),
    path("api/teams/", api_views.api_teams_list, name="api_teams_list"),
    path("api/marketplace/", api_views.api_marketplace_list, name="api_marketplace_list"),
    path("api/search/", api_views.api_search, name="api_search"),
    path("api/notifications/mark-all-read/", api_views.api_notifications_mark_all_read, name="api_notifications_mark_all_read"),
    path("api/notifications/", api_views.api_notifications_list, name="api_notifications_list"),
    path("api/feed/", api_views.api_feed_list, name="api_feed_list"),
    path("api/messages/<int:conversation_id>/send/", api_views.api_conversation_send_message, name="api_conversation_send_message"),
    path("api/messages/<int:conversation_id>/", api_views.api_conversation_detail, name="api_conversation_detail"),
    path("api/messages/", api_views.api_conversations_list, name="api_conversations_list"),
    path("api/profiles/gamers/", api_views.api_gamers_list, name="api_gamers_list"),
    path("api/radar/map/", api_views.api_map_data, name="api_radar_map"),
    path("api/leaderboards/", api_views.api_leaderboards, name="api_leaderboards"),
    path("api/live/", api_views.api_live, name="api_live"),
    path("api/profiles/detail/<str:gamer_tag>/", api_views.api_profile_detail, name="api_profile_detail"),
    path("api/profiles/<str:gamer_tag>/<str:action>/", api_views.api_profile_connection, name="api_profile_connection"),
    path("api/profiles/<str:gamer_tag>/games/<int:game_id>/remove/", api_views.api_profile_game_remove, name="api_profile_game_remove"),
    path("api/profiles/<str:gamer_tag>/games/add/", api_views.api_profile_game_add, name="api_profile_game_add"),
    path("api/tournaments/<slug:slug>/", api_views.api_tournament_detail, name="api_tournament_detail"),
    path("api/tournaments/<slug:slug>/register/", api_views.api_tournament_register, name="api_tournament_register"),
    path("api/tournaments/<slug:slug>/leave/", api_views.api_tournament_leave, name="api_tournament_leave"),
    path("api/events/<int:event_id>/", api_views.api_event_detail, name="api_event_detail"),
    path("api/events/<int:event_id>/rsvp/", api_views.api_event_rsvp, name="api_event_rsvp"),
    path("api/events/<int:event_id>/leave/", api_views.api_event_leave, name="api_event_leave"),
    path("api/teams/create/", api_views.api_team_create, name="api_team_create"),
    path("api/teams/<slug:slug>/", api_views.api_team_detail, name="api_team_detail"),
    path("api/marketplace/<int:listing_id>/", api_views.api_marketplace_detail, name="api_marketplace_detail"),
    path("api/marketplace/<int:listing_id>/save/", api_views.api_marketplace_save, name="api_marketplace_save"),
    path("api/marketplace/<int:listing_id>/report/", api_views.api_marketplace_report, name="api_marketplace_report"),
    path("api/marketplace/<int:listing_id>/contact/", api_views.api_marketplace_contact, name="api_marketplace_contact"),
    path("api/feed/posts/<int:post_id>/", api_views.api_feed_detail, name="api_feed_detail"),
    path("api/feed/posts/<int:post_id>/comments/", api_views.api_feed_comment_create, name="api_feed_comment_create"),
    path("api/security/overview/", api_views.api_security_overview, name="api_security_overview"),
    path("api/security/presence/", api_views.api_presence_update, name="api_presence_update"),
    path("api/security/export/", api_views.api_data_export, name="api_data_export"),
    path("api/messages/start/<str:gamer_tag>/", api_views.api_conversation_start, name="api_conversation_start"),
    path("api/messages/requests/<str:gamer_tag>/<str:action>/", api_views.api_message_request_action, name="api_message_request_action"),
    path("api/feed/create/", api_views.api_feed_create, name="api_feed_create"),
    path("api/feed/posts/<int:post_id>/like/", api_views.api_feed_like, name="api_feed_like"),
    path("api/feed/posts/<int:post_id>/save/", api_views.api_feed_save, name="api_feed_save"),
    path("api/feed/posts/<int:post_id>/report/", api_views.api_feed_report, name="api_feed_report"),
    path("api/notifications/<int:notification_id>/read/", api_views.api_notification_read, name="api_notification_read"),
    path("admin/", admin.site.urls),
    path("profiles/", include("accounts.urls")),
    path("games/", include("games.urls")),
    path("marketplace/", include("marketplace.urls")),
    path("teams/", include("teams.urls")),
    path("events/", event_views.event_list, name="event_list"),
    path("events/my/", event_views.event_my, name="event_my"),
    path("events/create/", event_views.event_create, name="event_create"),
    path("organizations/create/", event_views.organization_create, name="organization_create"),
    path("organizations/", event_views.organization_list, name="organization_list"),
    path("organizations/dashboard/", event_views.organization_portal, name="organization_portal"),
    path("organizations/dashboard/<slug:slug>/", event_views.organization_dashboard, name="organization_dashboard"),
    path("organizations/dashboard/<slug:slug>/profile/edit/", event_views.organization_edit, name="organization_edit"),
    path("organizations/dashboard/<slug:slug>/locations/create/", event_views.organization_location_create, name="organization_location_create"),
    path("organizations/dashboard/<slug:slug>/locations/<int:location_id>/edit/", event_views.organization_location_edit, name="organization_location_edit"),
    path("organizations/dashboard/<slug:slug>/locations/<int:location_id>/<str:action>/", event_views.organization_location_visibility, name="organization_location_visibility"),
    path("organizations/<slug:slug>/profile/", event_views.organization_public_profile, name="organization_public_profile_legacy"),
    path("organizations/<slug:slug>/", event_views.organization_public_profile, name="organization_public_profile"),
    path("events/<int:event_id>/promotion/request/", event_views.event_promotion_request, name="event_promotion_request"),
    path("events/promotion/<int:request_id>/<str:action>/", event_views.event_promotion_review, name="event_promotion_review"),
    path("events/<int:event_id>/", event_views.event_detail, name="event_detail"),
    path("events/<int:event_id>/rsvp/", event_views.event_rsvp, name="event_rsvp"),
    path("events/<int:event_id>/leave/", event_views.event_leave, name="event_leave"),
    path("events/<int:event_id>/edit/", event_views.event_edit, name="event_edit"),
    path("events/<int:event_id>/publish/", event_views.event_publish, name="event_publish"),
    path("events/<int:event_id>/cancel/", event_views.event_cancel, name="event_cancel"),
    path("events/<int:event_id>/delete/", event_views.event_delete, name="event_delete"),
    path("tournaments/", tournament_views.tournament_list, name="tournament_list"),
    path("tournaments/create/", tournament_views.tournament_create, name="tournament_create"),
    path("tournaments/my/", tournament_views.tournament_my, name="tournament_my"),
    path("tournaments/<slug:slug>/edit/", tournament_views.tournament_edit, name="tournament_edit"),
    path("tournaments/<slug:slug>/delete/", tournament_views.tournament_delete, name="tournament_delete"),
    path("tournaments/<slug:slug>/toggle-registration/", tournament_views.tournament_toggle_registration, name="tournament_toggle_registration"),
    path("tournaments/<slug:slug>/cancel/", tournament_views.tournament_cancel, name="tournament_cancel"),
    path("tournaments/<slug:slug>/manage/", tournament_views.tournament_manage, name="tournament_manage"),
    path("tournaments/<slug:slug>/invite/", tournament_views.tournament_invite, name="tournament_invite"),
    path("tournaments/invitations/<int:invitation_id>/<str:action>/", tournament_views.tournament_invitation_action, name="tournament_invitation_action"),
    path("tournaments/<slug:slug>/generate-bracket/", tournament_views.generate_bracket, name="generate_bracket"),
    path("tournaments/registrations/<int:registration_id>/<str:action>/", tournament_views.registration_action, name="registration_action"),
    path("tournaments/<slug:slug>/", tournament_views.tournament_detail, name="tournament_detail"),
    path("tournaments/<slug:slug>/register/", tournament_views.tournament_register, name="tournament_register"),
    path("tournaments/<slug:slug>/leave/", tournament_views.tournament_leave, name="tournament_leave"),
    path("tournaments/<slug:slug>/challenge/", tournament_views.challenge_create, name="challenge_create"),
    path("tournaments/<slug:slug>/matches/create/", tournament_views.match_create, name="match_create"),
    path("tournaments/challenges/<int:challenge_id>/<str:action>/", tournament_views.challenge_action, name="challenge_action"),
    path("tournaments/matches/<int:match_id>/result/", tournament_views.match_result, name="match_result"),
    path("tournaments/matches/<int:match_id>/schedule/", tournament_views.match_schedule, name="match_schedule"),
    path("feed/", account_views.feed, name="feed"),
    path("notifications/", account_views.notification_list, name="notification_list"),
    path("notifications/<int:notification_id>/read/", account_views.notification_read, name="notification_read"),
    path("notifications/<int:notification_id>/unread/", account_views.notification_unread, name="notification_unread"),
    path("notifications/read-all/", account_views.notifications_read_all, name="notifications_read_all"),
    path("messages/", account_views.conversation_list, name="conversation_list"),
    path("messages/requests/", account_views.message_requests, name="message_requests"),
    path("messages/<int:conversation_id>/", account_views.conversation_detail, name="conversation_detail"),
    path("messages/start/<str:gamer_tag>/", account_views.conversation_start, name="conversation_start"),
    path("messages/request/<str:gamer_tag>/<str:action>/", account_views.message_request_action, name="message_request_action"),
    path("feed/create/", account_views.post_create, name="post_create"),
    path("feed/refresh/", account_views.feed_refresh, name="feed_refresh"),
    path("feed/posts/<int:post_id>/", account_views.post_detail, name="post_detail"),
    path("feed/posts/<int:post_id>/edit/", account_views.post_edit, name="post_edit"),
    path("feed/posts/<int:post_id>/delete/", account_views.post_delete, name="post_delete"),
    path("feed/posts/<int:post_id>/like/", account_views.post_like, name="post_like"),
    path("feed/posts/<int:post_id>/save/", account_views.post_save_toggle, name="post_save_toggle"),
    path("feed/posts/<int:post_id>/download/", account_views.post_download, name="post_download"),
    path("feed/posts/<int:post_id>/report/", account_views.post_report, name="post_report"),
    path("accounts/login/", account_views.ggz_login, name="login"),
    path("accounts/logout/", account_views.ggz_logout, name="logout"),
    path("accounts/auth/google/start/", account_views.google_login_start, name="google_login_start"),
    path("accounts/auth/google/callback/", account_views.google_login_callback, name="google_login_callback"),
    path("accounts/auth/apple/start/", account_views.apple_login_start, name="apple_login_start"),
    path("accounts/auth/apple/callback/", account_views.apple_login_callback, name="apple_login_callback"),
    path("accounts/auth/discord/start/", account_views.discord_connect_start, name="discord_connect_start"),
    path("accounts/auth/discord/callback/", account_views.discord_connect_callback, name="discord_connect_callback"),
    path("accounts/security/unlink/<str:provider>/", account_views.unlink_provider, name="unlink_provider"),
    path("accounts/password_change/", account_views.ggz_password_change, name="password_change"),
    path("accounts/password_change/done/", account_views.ggz_password_change_done, name="password_change_done"),
    path("accounts/password_reset/", account_views.ggz_password_reset, name="password_reset"),
    path("accounts/password_reset/done/", account_views.ggz_password_reset_done, name="password_reset_done"),
    path("accounts/reset/<uidb64>/<token>/", account_views.ggz_password_reset_confirm, name="password_reset_confirm"),
    path("accounts/reset/done/", account_views.ggz_password_reset_complete, name="password_reset_complete"),
    path("__reload__/", include("django_browser_reload.urls")),
]
if settings.DEBUG:
    # The static() helper only emits routes while DEBUG is on; use it for
    # local static during development. Production static comes from
    # STATIC_ROOT after collectstatic.
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Serve user-uploaded media from MEDIA_ROOT whenever media is filesystem-backed
# (i.e. Supabase/S3 storage is not configured). The static() helper is gated on
# DEBUG, so bind django.views.static.serve explicitly to keep /media reachable
# in production hosts with persistent local storage. With S3 enabled no local
# route is needed (MEDIA_URL points at the public bucket instead). On serverless
# hosts (Vercel) local MEDIA_ROOT is ephemeral, so use the check_media_storage
# command to sync media into S3 for durability.
if not settings.USE_S3_MEDIA_STORAGE:
    from django.urls import re_path
    from django.views.static import serve as media_serve

    def _serve_media(request, path, **kwargs):
        return media_serve(request, path, document_root=settings.MEDIA_ROOT)

    urlpatterns += [
        re_path(
            r"^%s(?P<path>.*)$" % re.escape(settings.MEDIA_URL.lstrip("/")),
            _serve_media,
        )
    ]
