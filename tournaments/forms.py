import re

from django import forms

from accounts.models import GamerProfile

from .models import Challenge, Tournament, TournamentMatch

from hello_world.utils import _validated_image


class TournamentForm(forms.ModelForm):
    class Meta:
        model = Tournament
        fields = ("game", "name", "description", "banner", "format", "max_participants", "start_date", "registration_deadline", "location", "mode", "entry_type", "prize_description", "rules", "status")
        widgets = {"start_date": forms.DateTimeInput(attrs={"type": "datetime-local"}), "registration_deadline": forms.DateTimeInput(attrs={"type": "datetime-local"}), "description": forms.Textarea(attrs={"rows": 5}), "rules": forms.Textarea(attrs={"rows": 5})}

    def clean_banner(self):
        return _validated_image(self.cleaned_data.get("banner"), "banner")


class ChallengeForm(forms.ModelForm):
    class Meta:
        model = Challenge
        fields = ("opponent", "game", "tournament", "scheduled_at")
        widgets = {"scheduled_at": forms.DateTimeInput(attrs={"type": "datetime-local"})}


class MatchResultForm(forms.ModelForm):
    class Meta:
        model = TournamentMatch
        fields = ("winner", "score")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        participant_ids = [player_id for player_id in (self.instance.player_one_id, self.instance.player_two_id) if player_id]
        if participant_ids:
            self.fields["winner"].queryset = GamerProfile.objects.filter(id__in=participant_ids).order_by("gamer_tag")

    def clean_score(self):
        score = self.cleaned_data.get("score", "")
        if not score:
            return score
        if not re.fullmatch(r"\d+\s*-\s*\d+", score.strip()):
            raise forms.ValidationError("Score must use the format '2-0'.")
        return score.strip()

    def clean(self):
        cleaned = super().clean()
        winner = cleaned.get("winner")
        if winner and winner not in (self.instance.player_one, self.instance.player_two):
            self.add_error("winner", "Winner must be one of the match participants.")
        if not winner or not cleaned.get("score"):
            raise forms.ValidationError("A completed match requires a winner and score.")
        return cleaned

class MatchCreateForm(forms.ModelForm):
    class Meta:
        model = TournamentMatch
        fields = ("game", "player_one", "player_two", "round", "scheduled_at", "status")
        widgets = {"scheduled_at": forms.DateTimeInput(attrs={"type": "datetime-local"})}


class MatchScheduleForm(forms.ModelForm):
    class Meta:
        model = TournamentMatch
        fields = ("scheduled_at",)
        widgets = {"scheduled_at": forms.DateTimeInput(attrs={"type": "datetime-local"})}
