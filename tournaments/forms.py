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

class MatchCreateForm(forms.ModelForm):
    class Meta:
        model = TournamentMatch
        fields = ("game", "player_one", "player_two", "round", "scheduled_at", "status")
        widgets = {"scheduled_at": forms.DateTimeInput(attrs={"type": "datetime-local"})}
