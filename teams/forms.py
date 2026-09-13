from django import forms
from django.utils.text import slugify

from .models import Team


class TeamForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["game"].required = False
        self.fields["game"].empty_label = "Open roster (no game)"
        self.fields["game"].help_text = "Pick the game this squad plays."

    class Meta:
        model = Team
        fields = ("name", "tag", "description", "game")
        widgets = {"description": forms.Textarea(attrs={"rows": 5})}

    def clean_name(self):
        name = self.cleaned_data["name"].strip()
        slug = slugify(name)
        teams = Team.objects.filter(slug=slug)
        if self.instance and self.instance.pk:
            teams = teams.exclude(pk=self.instance.pk)
        if teams.exists():
            raise forms.ValidationError("A team with this name already exists.")
        return name
