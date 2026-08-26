from django import forms

from .models import Challenge, Tournament, TournamentMatch


class TournamentForm(forms.ModelForm):
    class Meta:
        model = Tournament
        fields = ("game", "name", "description", "banner", "format", "max_participants", "start_date", "registration_deadline", "location", "mode", "entry_type", "prize_description", "rules", "status")
        widgets = {"start_date": forms.DateTimeInput(attrs={"type": "datetime-local"}), "registration_deadline": forms.DateTimeInput(attrs={"type": "datetime-local"}), "description": forms.Textarea(attrs={"rows": 5}), "rules": forms.Textarea(attrs={"rows": 5})}


class ChallengeForm(forms.ModelForm):
    class Meta:
        model = Challenge
        fields = ("opponent", "game", "tournament", "scheduled_at")
        widgets = {"scheduled_at": forms.DateTimeInput(attrs={"type": "datetime-local"})}


class MatchResultForm(forms.ModelForm):
    class Meta:
        model = TournamentMatch
        fields = ("winner", "score", "status")

    def clean(self):
        cleaned = super().clean()
        winner = cleaned.get("winner")
        if winner and winner not in (self.instance.player_one, self.instance.player_two):
            self.add_error("winner", "Winner must be one of the match participants.")
        if cleaned.get("status") == "Completed" and (not winner or not cleaned.get("score")):
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
