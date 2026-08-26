from django import forms
from django.utils.text import slugify

from .models import Team


class TeamForm(forms.ModelForm):
    class Meta:
        model = Team
        fields = ("name", "tag", "description")
        widgets = {"description": forms.Textarea(attrs={"rows": 5})}

    def clean_name(self):
        name = self.cleaned_data["name"].strip()
        if Team.objects.filter(slug=slugify(name)).exists():
            raise forms.ValidationError("A team with this name already exists.")
        return name
