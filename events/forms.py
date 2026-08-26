from django import forms
from .models import Event


class EventForm(forms.ModelForm):
    class Meta:
        model = Event
        fields = ("game", "name", "description", "banner", "start_date", "location", "mode", "capacity", "status")
        widgets = {"start_date": forms.DateTimeInput(attrs={"type": "datetime-local"}), "description": forms.Textarea(attrs={"rows": 5})}
