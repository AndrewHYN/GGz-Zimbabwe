from django.urls import path
from . import views

urlpatterns = [
    path("", views.team_list, name="team_list"),
    path("create/", views.team_create, name="team_create"),
    path("invitations/", views.team_invitations, name="team_invitations"),
    path("invitations/<int:invitation_id>/<str:action>/", views.team_invitation_action, name="team_invitation_action"),
    path("<slug:slug>/invite/", views.team_invite, name="team_invite"),
    path("<slug:slug>/leave/", views.team_leave, name="team_leave"),
    path("<slug:slug>/remove-member/<int:member_id>/", views.team_remove_member, name="team_remove_member"),
    path("<slug:slug>/transfer-ownership/", views.team_transfer_ownership, name="team_transfer_ownership"),
    path("<slug:slug>/", views.team_detail, name="team_detail"),
]
