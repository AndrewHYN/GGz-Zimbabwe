from django import forms
from django.utils.text import slugify

from .models import Event, EventPromotionRequest, Organization, OrganizationLocation


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


class OrganizationLocationForm(forms.ModelForm):
    class Meta:
        model = OrganizationLocation
        fields = (
            "name",
            "location_type",
            "address",
            "city",
            "country",
            "description",
            "phone",
            "website",
            "opening_hours",
            "latitude",
            "longitude",
            "public_visible",
        )
        widgets = {
            "description": forms.Textarea(attrs={"rows": 4}),
            "opening_hours": forms.TextInput(attrs={"placeholder": "Mon-Sun: 10:00-22:00"}),
            "latitude": forms.HiddenInput(),
            "longitude": forms.HiddenInput(),
        }

    def save(self, commit=True, organization=None):
        location = super().save(commit=False)
        if organization is not None:
            location.organization = organization
        if commit:
            location.save()
        return location

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk is None:
            self.fields["public_visible"].initial = False


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
