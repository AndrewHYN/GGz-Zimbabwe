"""Small, free 1v1 pilot workflow. Existing bracket/result rules stay authoritative."""
import json
from django import forms
from django.db import transaction
from django.http import JsonResponse, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from django.views.decorators.http import require_GET, require_POST
from accounts.models import GamerProfile
from accounts.views import _rate_limit_exceeded
from games.models import Game
from .models import Tournament
from . import views


def error(message, status=400):
    return JsonResponse({'ok': False, 'error': message}, status=status)


def payload(request):
    try:
        value = json.loads(request.body or '{}')
        return value if isinstance(value, dict) else None
    except (ValueError, UnicodeDecodeError):
        return None


def profile(request):
    if not request.user.is_authenticated:
        return None
    return GamerProfile.objects.filter(user=request.user).first()


def summary(t):
    return {'id': t.id, 'slug': t.slug, 'name': t.name, 'game_name': t.game.name,
            'status': t.status, 'start_date': t.start_date.isoformat(),
            'location': t.location, 'mode': t.mode, 'max_participants': t.max_participants,
            'participant_count': t.participant_count}


class PilotForm(forms.ModelForm):
    class Meta:
        model = Tournament
        fields = ('game', 'name', 'description', 'start_date', 'registration_deadline',
                  'location', 'mode', 'max_participants', 'rules', 'prize_description')

    def clean(self):
        data = super().clean()
        start, deadline = data.get('start_date'), data.get('registration_deadline')
        if start and start <= timezone.now():
            self.add_error('start_date', 'Choose a future start time.')
        if deadline and (deadline <= timezone.now() or (start and deadline > start)):
            self.add_error('registration_deadline', 'Registration must close in the future, no later than the event starts.')
        if data.get('mode') == 'offline' and not data.get('location', '').strip():
            self.add_error('location', 'Tell players which public venue to visit.')
        if not 2 <= (data.get('max_participants') or 0) <= 32:
            self.add_error('max_participants', 'Pilot events support 2 to 32 players.')
        if not data.get('rules', '').strip():
            self.add_error('rules', 'Add game/platform, check-in, no-show and dispute instructions.')
        return data


@require_GET
def my_competitions(request):
    p = profile(request)
    if not p:
        return error('Sign in to see your events.', 401)
    return JsonResponse({'profile': {'gamer_tag': p.gamer_tag, 'games': list(p.games.values('id', 'name'))},
                         'organized': [summary(t) for t in Tournament.objects.filter(organizer=p).select_related('game')],
                         'joined': [summary(t) for t in Tournament.objects.filter(registrations__player=p, registrations__status='Registered').select_related('game')]})


@require_POST
def choose_game(request):
    p = profile(request)
    if not p:
        return error('Sign in to choose your game.', 401)
    data = payload(request)
    if data is None:
        return error('Invalid request.')
    try:
        game = Game.objects.get(pk=int(data.get('game', 0)))
    except (ValueError, TypeError, Game.DoesNotExist):
        return error('Choose a game from the list.')
    p.games.add(game)
    return JsonResponse({'ok': True, 'message': f'{game.name} added to your games.'})


@require_POST
def create_competition(request):
    p = profile(request)
    if not p:
        return error('Sign in to host an event.', 401)
    if _rate_limit_exceeded(request, 'pilot_create', 5, 600):
        return error('Please wait before creating another event.', 429)
    data = payload(request)
    if data is None:
        return error('Invalid request.')
    form = PilotForm(data)
    if not form.is_valid():
        return JsonResponse({'ok': False, 'error': 'Check the event details.', 'errors': dict(form.errors)}, status=400)
    t = form.save(commit=False)
    t.organizer, t.format, t.entry_type, t.status = p, '1v1', 'Free', 'Draft'
    # Distinct suffix avoids collisions without replacing an existing event.
    from uuid import uuid4
    t.slug = f'{slugify(t.name)[:140] or "event"}-{uuid4().hex[:8]}'
    t.save()
    return JsonResponse({'ok': True, 'slug': t.slug}, status=201)


@require_POST
def organizer_action(request, slug, action):
    p = profile(request)
    if not p:
        return error('Sign in to manage your event.', 401)
    request.META['HTTP_X_REQUESTED_WITH'] = 'XMLHttpRequest'
    with transaction.atomic():
        t = get_object_or_404(Tournament.objects.select_for_update(), slug=slug, organizer=p)
        if action in ('open', 'close'):
            if t.matches.exists() or t.status in ('Live', 'Completed', 'Cancelled'):
                return error('Registration cannot change after the bracket starts.', 409)
            if action == 'open' and t.registration_deadline <= timezone.now():
                return error('The registration deadline has passed.', 409)
            t.status = 'Registration Open' if action == 'open' else 'Registration Closed'
            t.save(update_fields=['status'])
            return JsonResponse({'ok': True, 'message': 'Registration opened.' if action == 'open' else 'Registration closed.'})
        if action == 'bracket':
            if t.status not in ('Registration Open', 'Registration Closed'):
                return error('Publish the event before starting its bracket.', 409)
            response = views.generate_bracket(request, slug)
            if response.status_code == 200:
                t.status = 'Live'
                t.save(update_fields=['status'])
            return response
        if action == 'cancel':
            if t.status == 'Completed':
                return error('A completed event cannot be cancelled.', 409)
            return views.tournament_cancel(request, slug)
    return error('Unknown event action.')


@require_POST
def record_result(request, slug, match_id):
    p = profile(request)
    if not p:
        return error('Sign in to record a result.', 401)
    request.META['HTTP_X_REQUESTED_WITH'] = 'XMLHttpRequest'
    data = payload(request)
    if data is None:
        return error('Invalid result.')
    form_data = QueryDict('', mutable=True)
    for key in ('winner', 'score'):
        form_data[key] = str(data.get(key, ''))
    request.POST = form_data
    with transaction.atomic():
        t = get_object_or_404(Tournament.objects.select_for_update(), slug=slug, organizer=p)
        if t.status != 'Live':
            return error('Results can only be recorded during a live event.', 409)
        get_object_or_404(t.matches, pk=match_id)
        return views.match_result(request, match_id)
