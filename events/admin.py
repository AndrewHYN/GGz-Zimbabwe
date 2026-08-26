from django.contrib import admin

from .models import Event, EventRsvp

admin.site.register(Event)
admin.site.register(EventRsvp)
