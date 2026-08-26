from django.contrib import admin
from .models import Team, TeamInvitation, TeamMembership

admin.site.register(Team)
admin.site.register(TeamMembership)
admin.site.register(TeamInvitation)
