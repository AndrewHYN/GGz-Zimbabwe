import json
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from accounts.models import GamerProfile, Notification, Post
from events.models import Event
from games.models import Game
from marketplace.models import Listing
from teams.models import Team
from tournaments.models import Tournament


@require_GET
@login_required(login_url='/accounts/login/')
def api_me(request):
    user = request.user
    try:
        profile = GamerProfile.objects.get(user=user)
        profile_data = {
            'gamer_tag': profile.gamer_tag,
            'avatar': profile.avatar,
        }
    except GamerProfile.DoesNotExist:
        profile_data = {
            'gamer_tag': None,
            'avatar': None,
        }

    return JsonResponse({
        'authenticated': True,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
        },
        'profile': profile_data,
    })


@require_GET
def api_games_list(request):
    games = Game.objects.all()
    data = []
    for game in games:
        data.append({
            'id': game.id,
            'name': game.name,
            'slug': game.slug,
            'cover_art_url': getattr(game, 'cover_art_url', None),
            'genre': getattr(game, 'genre', None),
            'platform': getattr(game, 'platform', None),
            'developer': getattr(game, 'developer', None),
            'description': getattr(game, 'description', None),
            'release_year': getattr(game, 'release_year', None),
            'player_count': getattr(game, 'player_count', None),
            'free_to_play': getattr(game, 'free_to_play', False),
            'featured': getattr(game, 'featured', False),
        })
    return JsonResponse(data, safe=False)


@require_GET
def api_game_detail(request, game_id):
    try:
        game = Game.objects.get(id=game_id)
    except Game.DoesNotExist:
        return JsonResponse({'error': 'Game not found'}, status=404)

    data = {
        'id': game.id,
        'name': game.name,
        'slug': game.slug,
        'cover_art_url': getattr(game, 'cover_art_url', None),
        'genre': getattr(game, 'genre', None),
        'platform': getattr(game, 'platform', None),
        'developer': getattr(game, 'developer', None),
        'description': getattr(game, 'description', None),
        'release_year': getattr(game, 'release_year', None),
        'player_count': getattr(game, 'player_count', None),
        'free_to_play': getattr(game, 'free_to_play', False),
        'featured': getattr(game, 'featured', False),
        'steam_url': getattr(game, 'steam_url', None),
        'epic_url': getattr(game, 'epic_url', None),
        'store_url': getattr(game, 'store_url', None),
        'trailer_url': getattr(game, 'trailer_url', None),
        'igdb_rating': getattr(game, 'igdb_rating', None),
    }
    return JsonResponse(data)


@require_GET
def api_tournaments_list(request):
    tournaments = Tournament.objects.all()
    data = []
    for t in tournaments:
        data.append({
            'id': t.id,
            'name': t.name,
            'slug': t.slug,
            'game_name': getattr(t, 'game_name', None),
            'format': getattr(t, 'format', None),
            'status': getattr(t, 'status', None),
            'start_date': t.start_date.isoformat() if t.start_date else None,
            'location': getattr(t, 'location', None),
            'mode': getattr(t, 'mode', None),
            'max_participants': getattr(t, 'max_participants', None),
        })
    return JsonResponse(data, safe=False)


@require_GET
def api_events_list(request):
    events = Event.objects.all()
    data = []
    for e in events:
        data.append({
            'id': e.id,
            'name': e.name,
            'description': getattr(e, 'description', None),
            'start_date': e.start_date.isoformat() if e.start_date else None,
            'location': getattr(e, 'location', None),
            'mode': getattr(e, 'mode', None),
            'status': getattr(e, 'status', None),
            'banner': getattr(e, 'banner', None),
            'game_name': getattr(e, 'game_name', None),
            'organization_name': getattr(e, 'organization_name', None),
        })
    return JsonResponse(data, safe=False)


@require_GET
def api_teams_list(request):
    teams = Team.objects.all()
    data = []
    for team in teams:
        data.append({
            'id': team.id,
            'name': team.name,
            'tag': getattr(team, 'tag', None),
            'slug': team.slug,
            'description': getattr(team, 'description', None),
            'location': getattr(team, 'location', None),
            'status': getattr(team, 'status', None),
            'member_count': team.memberships.count(),
        })
    return JsonResponse(data, safe=False)


@require_GET
def api_marketplace_list(request):
    listings = Listing.objects.all()
    data = []
    for listing in listings:
        data.append({
            'id': listing.id,
            'title': listing.title,
            'description': getattr(listing, 'description', None),
            'category': getattr(listing, 'category', None),
            'price': str(listing.price) if hasattr(listing, 'price') and listing.price else None,
            'condition': getattr(listing, 'condition', None),
            'location': getattr(listing, 'location', None),
            'platform': getattr(listing, 'platform', None),
            'status': getattr(listing, 'status', None),
            'seller_name': listing.seller.gamer_tag if hasattr(listing, 'seller') and listing.seller else None,
            'game_name': getattr(listing, 'game_name', None),
            'created_at': listing.created_at.isoformat() if listing.created_at else None,
        })
    return JsonResponse(data, safe=False)


@require_GET
def api_search(request):
    q = request.GET.get('q', '').strip()
    if not q:
        return JsonResponse({
            'games': [],
            'gamers': [],
            'teams': [],
            'tournaments': [],
            'events': [],
        })

    games = Game.objects.filter(name__icontains=q)
    games_data = [
        {
            'id': g.id,
            'name': g.name,
            'slug': g.slug,
            'cover_art_url': getattr(g, 'cover_art_url', None),
            'genre': getattr(g, 'genre', None),
            'platform': getattr(g, 'platform', None),
            'developer': getattr(g, 'developer', None),
            'description': getattr(g, 'description', None),
            'release_year': getattr(g, 'release_year', None),
            'player_count': getattr(g, 'player_count', None),
            'free_to_play': getattr(g, 'free_to_play', False),
            'featured': getattr(g, 'featured', False),
        }
        for g in games
    ]

    gamers = GamerProfile.objects.filter(gamer_tag__icontains=q)
    gamers_data = [
        {
            'id': gp.id,
            'gamer_tag': gp.gamer_tag,
            'avatar': gp.avatar,
            'bio': getattr(gp, 'bio', None),
            'location': getattr(gp, 'location', None),
            'platform': getattr(gp, 'platform', None),
        }
        for gp in gamers
    ]

    teams = Team.objects.filter(name__icontains=q)
    teams_data = [
        {
            'id': t.id,
            'name': t.name,
            'tag': getattr(t, 'tag', None),
            'slug': t.slug,
            'description': getattr(t, 'description', None),
            'location': getattr(t, 'location', None),
            'status': getattr(t, 'status', None),
            'member_count': t.memberships.count(),
        }
        for t in teams
    ]

    tournaments = Tournament.objects.filter(name__icontains=q)
    tournaments_data = [
        {
            'id': t.id,
            'name': t.name,
            'slug': t.slug,
            'game_name': getattr(t, 'game_name', None),
            'format': getattr(t, 'format', None),
            'status': getattr(t, 'status', None),
            'start_date': t.start_date.isoformat() if t.start_date else None,
            'location': getattr(t, 'location', None),
            'mode': getattr(t, 'mode', None),
            'max_participants': getattr(t, 'max_participants', None),
        }
        for t in tournaments
    ]

    events = Event.objects.filter(name__icontains=q)
    events_data = [
        {
            'id': e.id,
            'name': e.name,
            'description': getattr(e, 'description', None),
            'start_date': e.start_date.isoformat() if e.start_date else None,
            'location': getattr(e, 'location', None),
            'mode': getattr(e, 'mode', None),
            'status': getattr(e, 'status', None),
            'banner': getattr(e, 'banner', None),
            'game_name': getattr(e, 'game_name', None),
            'organization_name': getattr(e, 'organization_name', None),
        }
        for e in events
    ]

    return JsonResponse({
        'games': games_data,
        'gamers': gamers_data,
        'teams': teams_data,
        'tournaments': tournaments_data,
        'events': events_data,
    }, safe=False)


@require_GET
@login_required(login_url='/accounts/login/')
def api_notifications_list(request):
    notifications = Notification.objects.filter(user=request.user).order_by('-created_at')
    data = []
    for n in notifications:
        data.append({
            'id': n.id,
            'actor': n.actor.gamer_tag if hasattr(n, 'actor') and n.actor else None,
            'verb': n.verb,
            'target_type': getattr(n, 'target_type', None),
            'target_id': getattr(n, 'target_id', None),
            'is_read': n.is_read,
            'created_at': n.created_at.isoformat() if n.created_at else None,
        })
    return JsonResponse(data, safe=False)


@require_GET
@login_required(login_url='/accounts/login/')
def api_feed_list(request):
    posts = Post.objects.select_related('author').all()
    data = []
    for post in posts:
        try:
            profile = GamerProfile.objects.get(user=post.author)
            author_data = {
                'gamer_tag': profile.gamer_tag,
                'avatar': profile.avatar,
            }
        except GamerProfile.DoesNotExist:
            author_data = {
                'gamer_tag': post.author.username,
                'avatar': None,
            }

        data.append({
            'id': post.id,
            'author': author_data,
            'content': post.content,
            'created_at': post.created_at.isoformat() if post.created_at else None,
            'like_count': post.likes.count(),
            'comment_count': post.comments.count(),
        })
    return JsonResponse(data, safe=False)


@require_GET
@login_required(login_url='/accounts/login/')
def api_conversations_list(request):
    from accounts.models import ConversationParticipant

    participants = ConversationParticipant.objects.filter(user=request.user)
    data = []
    for p in participants:
        conversation = p.conversation
        other_participants = ConversationParticipant.objects.filter(
            conversation=conversation
        ).exclude(user=request.user)
        data.append({
            'id': conversation.id,
            'participants': [
                {
                    'id': op.user.id,
                    'username': op.user.username,
                    'gamer_tag': op.user.gamer_tag if hasattr(op.user, 'gamer_tag') else None,
                }
                for op in other_participants
            ],
        })
    return JsonResponse(data, safe=False)


@require_GET
def api_gamers_list(request):
    gamers = GamerProfile.objects.all()
    data = []
    for gp in gamers:
        data.append({
            'id': gp.id,
            'gamer_tag': gp.gamer_tag,
            'avatar': gp.avatar,
            'bio': getattr(gp, 'bio', None),
            'location': getattr(gp, 'location', None),
            'platform': getattr(gp, 'platform', None),
        })
    return JsonResponse(data, safe=False)
