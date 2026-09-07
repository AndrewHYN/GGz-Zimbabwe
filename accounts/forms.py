import re

from django import forms
from django.conf import settings
from django.contrib.auth import password_validation
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.core.files.uploadedfile import UploadedFile
from django.core.validators import EmailValidator
from django.forms import ValidationError

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

    def clean_avatar(self):
        avatar = self.cleaned_data.get("avatar")
        if isinstance(avatar, UploadedFile) and avatar.size > settings.MAX_UPLOAD_SIZE:
            raise forms.ValidationError("Images must be 4 MB or smaller.")
        return avatar

    def save(self, commit=True):
        old_avatar_name = self.instance.avatar.name if self.instance.avatar else None
        profile = super().save(commit=commit)
        if commit and old_avatar_name and profile.avatar.name != old_avatar_name:
            profile.avatar.storage.delete(old_avatar_name)
        return profile


class SignupForm(UserCreationForm):
    email = forms.EmailField(required=True, help_text="We use this for account recovery and security alerts.")
    gamer_tag = forms.CharField(max_length=50, help_text="Your public identity on GGz.")

    class Meta:
        model = User
        fields = ("username", "email", "gamer_tag", "password1", "password2")
        widgets = {
            "username": forms.TextInput(attrs={"autocomplete": "username", "autocapitalize": "none"}),
            "email": forms.EmailInput(attrs={"autocomplete": "email"}),
            "gamer_tag": forms.TextInput(attrs={"autocomplete": "nickname"}),
        }

    def clean_username(self):
        username = self.cleaned_data["username"].strip()
        if not re.match(r"^[A-Za-z0-9_.-]+$", username):
            raise forms.ValidationError("Username can only contain letters, numbers, underscores, dots, and hyphens.")
        if User.objects.filter(username__iexact=username).exists():
            raise forms.ValidationError("This username is already in use.")
        return username

    def clean_email(self):
        email = self.cleaned_data["email"].strip()
        validator = EmailValidator()
        validator(email)
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("This email is already in use.")
        return email

    def clean_password1(self):
        password = self.cleaned_data.get("password1")
        if password:
            password_validation.validate_password(password, self.instance)
        return password

    def clean_gamer_tag(self):
        gamer_tag = self.cleaned_data["gamer_tag"].strip()
        if not re.match(r"^[A-Za-z0-9_]+$", gamer_tag):
            raise forms.ValidationError("Gamer tag can only contain letters, numbers, and underscores.")
        if GamerProfile.objects.filter(gamer_tag__iexact=gamer_tag).exists():
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
        widgets = {
            "body": forms.Textarea(attrs={
                "rows": 4,
                "placeholder": "What is happening in your gaming world?",
                "class": "composer-textarea",
            }),
            "game": forms.Select(attrs={"class": "composer-game-select"}),
            "image": forms.ClearableFileInput(attrs={"class": "composer-file-input"}),
        }

    def clean_image(self):
        image = self.cleaned_data.get("image")
        if isinstance(image, UploadedFile) and image.size > settings.MAX_UPLOAD_SIZE:
            raise forms.ValidationError("Images must be 4 MB or smaller.")
        return image


class CommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ("body",)
        widgets = {"body": forms.Textarea(attrs={"rows": 2, "placeholder": "Add a comment...", "class": "comment-input"})}
