from django import forms

from .models import Listing, ListingImage

from hello_world.utils import _validated_image


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
        return _validated_image(self.cleaned_data["image"], "image")
