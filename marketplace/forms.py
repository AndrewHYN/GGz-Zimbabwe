from django import forms
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile

from .models import Listing, ListingImage


class ListingForm(forms.ModelForm):
    class Meta:
        model = Listing
        fields = ("title", "description", "category", "price", "condition", "location", "game", "platform", "status")
        widgets = {"description": forms.Textarea(attrs={"rows": 6})}


class ListingImageForm(forms.ModelForm):
    class Meta:
        model = ListingImage
        fields = ("image",)

    def clean_image(self):
        image = self.cleaned_data["image"]
        if isinstance(image, UploadedFile) and image.size > settings.MAX_UPLOAD_SIZE:
            raise forms.ValidationError("Images must be 4 MB or smaller.")
        return image
