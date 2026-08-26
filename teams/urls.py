from django.urls import path
from . import views

urlpatterns = [
    path("", views.team_list, name="team_list"),
    path("create/", views.team_create, name="team_create"),
    path("invitations/", views.team_invitations, name="team_invitations"),
    path("invitations/<int:invitation_id>/<str:action>/", views.team_invitation_action, name="team_invitation_action"),
    path("<slug:slug>/", views.team_detail, name="team_detail"),
]
