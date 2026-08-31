from django import forms
from django.utils.text import slugify

from .models import Event, EventPromotionRequest, Organization


class OrganizationForm(forms.ModelForm):
    class Meta:
        model = Organization
        fields = ("name", "organization_type", "description", "website", "social_link", "logo", "contact_email")

    def save(self, commit=True, owner=None):
        organization = super().save(commit=False)
        if not organization.slug:
            base_slug = slugify(organization.name)
            organization.slug = base_slug or "organization"
        if owner is not None:
            organization.owner = owner
        if commit:
            organization.save()
        return organization


class EventPromotionRequestForm(forms.ModelForm):
    class Meta:
        model = EventPromotionRequest
        fields = ("request_type", "campaign_description", "start_date", "end_date")
        widgets = {
            "start_date": forms.DateTimeInput(attrs={"type": "datetime-local"}),
            "end_date": forms.DateTimeInput(attrs={"type": "datetime-local"}),
            "campaign_description": forms.Textarea(attrs={"rows": 5}),
        }


class EventForm(forms.ModelForm):
    class Meta:
        model = Event
        fields = ("game", "organization", "name", "description", "banner", "start_date", "location", "venue", "mode", "capacity", "status")
        widgets = {"start_date": forms.DateTimeInput(attrs={"type": "datetime-local"}), "description": forms.Textarea(attrs={"rows": 5})}
