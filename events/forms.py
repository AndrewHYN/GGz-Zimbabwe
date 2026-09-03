from django import forms
from django.utils.text import slugify

from .models import Event, EventPromotionRequest, Organization, OrganizationLocation


class OrganizationForm(forms.ModelForm):
    class Meta:
        model = Organization
        fields = ("name", "organization_type", "description", "website", "social_link", "logo", "contact_email")

    def clean_logo(self):
        logo = self.cleaned_data.get("logo")
        if logo and logo.size > 5 * 1024 * 1024:
            raise forms.ValidationError("Images must be 5 MB or smaller.")
        return logo

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
            "latitude": forms.NumberInput(attrs={"step": "any", "placeholder": "Latitude", "inputmode": "decimal"}),
            "longitude": forms.NumberInput(attrs={"step": "any", "placeholder": "Longitude", "inputmode": "decimal"}),
        }

    def clean(self):
        cleaned_data = super().clean()
        latitude = cleaned_data.get("latitude")
        longitude = cleaned_data.get("longitude")

        if latitude is not None and latitude != "":
            try:
                latitude_value = float(latitude)
            except (TypeError, ValueError):
                self.add_error("latitude", "Latitude must be a valid number.")
                return cleaned_data
            if not (-90 <= latitude_value <= 90):
                self.add_error("latitude", "Latitude must be between -90 and 90 degrees.")

        if longitude is not None and longitude != "":
            try:
                longitude_value = float(longitude)
            except (TypeError, ValueError):
                self.add_error("longitude", "Longitude must be a valid number.")
                return cleaned_data
            if not (-180 <= longitude_value <= 180):
                self.add_error("longitude", "Longitude must be between -180 and 180 degrees.")

        if cleaned_data.get("public_visible") and (latitude in (None, "") or longitude in (None, "")):
            self.add_error("latitude", "Add a valid map location before activating this venue.")
            self.add_error("longitude", "Add a valid map location before activating this venue.")

        if latitude is None and longitude is None and self.instance.pk is not None:
            if self.instance.latitude is not None and self.instance.longitude is not None:
                cleaned_data["latitude"] = self.instance.latitude
                cleaned_data["longitude"] = self.instance.longitude

        return cleaned_data

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

    def clean_banner(self):
        banner = self.cleaned_data.get("banner")
        if banner and banner.size > 5 * 1024 * 1024:
            raise forms.ValidationError("Images must be 5 MB or smaller.")
        return banner
