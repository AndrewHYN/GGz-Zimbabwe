from django import forms

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
        if image.size > 5 * 1024 * 1024:
            raise forms.ValidationError("Images must be 5 MB or smaller.")
        return image
