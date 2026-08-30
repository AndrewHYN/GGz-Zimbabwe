from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User

from .models import Comment, GamerProfile, Post


class GamerProfileForm(forms.ModelForm):
    class Meta:
        model = GamerProfile
        fields = (
            "gamer_tag",
            "avatar",
            "bio",
            "location",
            "city",
            "province",
            "country",
            "latitude",
            "longitude",
            "location_public",
            "platform",
            "rank",
            "availability",
            "games",
            "youtube",
            "social_link",
            "discord_username",
            "playstation_username",
            "xbox_username",
            "steam_username",
            "riot_username",
        )
        widgets = {
            "bio": forms.Textarea(attrs={"rows": 5}),
        }

    def save(self, commit=True):
        old_avatar_name = self.instance.avatar.name if self.instance.avatar else None
        profile = super().save(commit=commit)
        if commit and old_avatar_name and profile.avatar.name != old_avatar_name:
            profile.avatar.storage.delete(old_avatar_name)
        return profile


class SignupForm(UserCreationForm):
    email = forms.EmailField(required=True)
    gamer_tag = forms.CharField(max_length=50)

    class Meta:
        model = User
        fields = ("username", "email", "gamer_tag", "password1", "password2")

    def clean_gamer_tag(self):
        gamer_tag = self.cleaned_data["gamer_tag"]
        if GamerProfile.objects.filter(gamer_tag=gamer_tag).exists():
            raise forms.ValidationError("That gamer tag is already in use.")
        return gamer_tag

    def save(self, commit=True):
        user = super().save(commit=commit)
        if commit:
            GamerProfile.objects.create(
                user=user,
                gamer_tag=self.cleaned_data["gamer_tag"],
            )
        return user


class PostForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = ("body", "game", "image")
        widgets = {"body": forms.Textarea(attrs={"rows": 4, "placeholder": "What is happening in your gaming world?"})}

    def clean_image(self):
        image = self.cleaned_data.get("image")
        if image and image.size > 5 * 1024 * 1024:
            raise forms.ValidationError("Images must be 5 MB or smaller.")
        return image


class CommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ("body",)
        widgets = {"body": forms.TextInput(attrs={"placeholder": "Add a comment..."})}
