from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.http import require_GET

from accounts.models import GamerProfile, Notification, Post
from events.models import Event
from games.models import Game
from marketplace.models import Listing
from teams.models import Team
from tournaments.models import Tournament


def _serialize_file_field(field):
    if not field:
        return None
    if hasattr(field, 'url'):
        return field.url
    return str(field)


@require_GET
def api_profile_detail(request, gamer_tag):
    from accounts.models import GamerProfile
    from django.shortcuts import get_object_or_404
    
    profile = get_object_or_404(GamerProfile, gamer_tag=gamer_tag)
    viewer = getattr(request.user, "gamer_profile", None) if request.user.is_authenticated else None
    
    data = {
        "id": profile.id,
        "gamer_tag": profile.gamer_tag,
        "avatar": _serialize_file_field(profile.avatar),
        "bio": profile.bio,
        "location": profile.location,
        "platform": profile.platform,
        "follower_count": profile.followers.count(),
        "following_count": profile.following.count(),
        "is_following": False,
        "followers": [],
        "following": [],
    }
    
    if viewer and viewer != profile:
        data["is_following"] = profile.followers.filter(id=viewer.id).exists()
    
    return JsonResponse(data)


@require_GET
def api_csrf_token(request):
    get_token(request)
    return JsonResponse({'ok': True})


@require_GET
def api_me(request):
    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)

    user = request.user
    try:
        profile = GamerProfile.objects.get(user=user)
        profile_data = {
            'gamer_tag': profile.gamer_tag,
            'avatar': _serialize_file_field(profile.avatar),
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
            'cover_art_url': game.cover_art_url or None,
            'genre': game.genre or None,
            'platform': game.platform or None,
            'developer': game.developer or None,
            'description': game.description or None,
            'release_year': game.release_year,
            'player_count': game.player_count,
            'free_to_play': game.free_to_play,
            'featured': game.featured,
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
        'cover_art_url': game.cover_art_url or None,
        'genre': game.genre or None,
        'platform': game.platform or None,
        'developer': game.developer or None,
        'description': game.description or None,
        'release_year': game.release_year,
        'player_count': game.player_count,
        'free_to_play': game.free_to_play,
        'featured': game.featured,
        'steam_url': game.steam_url or None,
        'epic_url': game.epic_url or None,
        'store_url': game.store_url or None,
        'trailer_url': game.trailer_url or None,
        'igdb_rating': float(game.igdb_rating) if game.igdb_rating else None,
    }
    return JsonResponse(data)


@require_GET
def api_tournaments_list(request):
    tournaments = Tournament.objects.select_related('game').all()
    data = []
    for t in tournaments:
        data.append({
            'id': t.id,
            'name': t.name,
            'slug': t.slug,
            'game_name': t.game.name if t.game else None,
            'format': t.format,
            'status': t.status,
            'start_date': t.start_date.isoformat() if t.start_date else None,
            'location': t.location or None,
            'mode': t.mode,
            'max_participants': t.max_participants,
        })
    return JsonResponse(data, safe=False)


@require_GET
def api_events_list(request):
    events = Event.objects.select_related('game', 'organization').all()
    data = []
    for e in events:
        data.append({
            'id': e.id,
            'name': e.name,
            'description': e.description or None,
            'start_date': e.start_date.isoformat() if e.start_date else None,
            'location': e.location or None,
            'mode': e.mode,
            'status': e.status,
            'banner': _serialize_file_field(e.banner),
            'game_name': e.game.name if e.game else None,
            'organization_name': e.organization.name if e.organization else None,
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
            'tag': team.tag,
            'slug': team.slug,
            'description': team.description or None,
            'location': team.location or None,
            'status': team.status,
            'member_count': team.memberships.count(),
        })
    return JsonResponse(data, safe=False)


@require_GET
def api_marketplace_list(request):
    listings = Listing.objects.select_related('seller', 'game').all()
    data = []
    for listing in listings:
        data.append({
            'id': listing.id,
            'title': listing.title,
            'description': listing.description or None,
            'category': listing.category,
            'price': str(listing.price),
            'condition': listing.condition,
            'location': listing.location,
            'platform': listing.platform or None,
            'status': listing.status,
            'seller_name': listing.seller.gamer_tag if listing.seller else None,
            'game_name': listing.game.name if listing.game else None,
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
            'cover_art_url': g.cover_art_url or None,
            'genre': g.genre or None,
            'platform': g.platform or None,
            'developer': g.developer or None,
            'description': g.description or None,
            'release_year': g.release_year,
            'player_count': g.player_count,
            'free_to_play': g.free_to_play,
            'featured': g.featured,
        }
        for g in games
    ]

    gamers = GamerProfile.objects.filter(gamer_tag__icontains=q)
    gamers_data = [
        {
            'id': gp.id,
            'gamer_tag': gp.gamer_tag,
            'avatar': _serialize_file_field(gp.avatar),
            'bio': gp.bio or None,
            'location': gp.location or None,
            'platform': gp.platform or None,
        }
        for gp in gamers
    ]

    teams = Team.objects.filter(name__icontains=q)
    teams_data = [
        {
            'id': t.id,
            'name': t.name,
            'tag': t.tag,
            'slug': t.slug,
            'description': t.description or None,
            'location': t.location or None,
            'status': t.status,
            'member_count': t.memberships.count(),
        }
        for t in teams
    ]

    tournaments = Tournament.objects.filter(name__icontains=q).select_related('game')
    tournaments_data = [
        {
            'id': t.id,
            'name': t.name,
            'slug': t.slug,
            'game_name': t.game.name if t.game else None,
            'format': t.format,
            'status': t.status,
            'start_date': t.start_date.isoformat() if t.start_date else None,
            'location': t.location or None,
            'mode': t.mode,
            'max_participants': t.max_participants,
        }
        for t in tournaments
    ]

    events = Event.objects.filter(name__icontains=q).select_related('game', 'organization')
    events_data = [
        {
            'id': e.id,
            'name': e.name,
            'description': e.description or None,
            'start_date': e.start_date.isoformat() if e.start_date else None,
            'location': e.location or None,
            'mode': e.mode,
            'status': e.status,
            'banner': _serialize_file_field(e.banner),
            'game_name': e.game.name if e.game else None,
            'organization_name': e.organization.name if e.organization else None,
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
def api_notifications_list(request):
    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)

    try:
        profile = GamerProfile.objects.get(user=request.user)
    except GamerProfile.DoesNotExist:
        return JsonResponse([], safe=False)

    notifications = Notification.objects.filter(
        recipient=profile
    ).select_related('actor').order_by('-created_at')

    data = []
    for n in notifications:
        data.append({
            'id': n.id,
            'actor': n.actor.gamer_tag if n.actor else None,
            'notification_type': n.notification_type,
            'message': n.message,
            'target_url': n.target_url or None,
            'is_read': n.is_read,
            'created_at': n.created_at.isoformat() if n.created_at else None,
        })
    return JsonResponse(data, safe=False)


@require_GET
def api_feed_list(request):
    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)

    posts = Post.objects.select_related('author', 'author__user', 'game').prefetch_related('likes', 'comments').all()

    data = []
    for post in posts:
        profile = post.author
        author_data = {
            'gamer_tag': profile.gamer_tag,
            'avatar': _serialize_file_field(profile.avatar),
        }

        data.append({
            'id': post.id,
            'author': author_data,
            'content': post.body,
            'created_at': post.created_at.isoformat() if post.created_at else None,
            'like_count': post.likes.count(),
            'comment_count': post.comments.count(),
        })
    return JsonResponse(data, safe=False)


@require_GET
def api_conversations_list(request):
    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)

    try:
        profile = GamerProfile.objects.get(user=request.user)
    except GamerProfile.DoesNotExist:
        return JsonResponse([], safe=False)

    from accounts.models import ConversationParticipant

    participants = ConversationParticipant.objects.filter(
        profile=profile
    ).select_related('conversation')

    data = []
    for p in participants:
        conversation = p.conversation
        other_links = ConversationParticipant.objects.filter(
            conversation=conversation
        ).select_related('profile', 'profile__user').exclude(profile=profile)

        data.append({
            'id': conversation.id,
            'participants': [
                {
                    'id': link.profile.user.id,
                    'username': link.profile.user.username,
                    'gamer_tag': link.profile.gamer_tag,
                }
                for link in other_links
            ],
        })
    return JsonResponse(data, safe=False)


@require_GET
def api_gamers_list(request):
    gamers = GamerProfile.objects.select_related('user').all()
    data = []
    for gp in gamers:
        data.append({
            'id': gp.id,
            'gamer_tag': gp.gamer_tag,
            'avatar': _serialize_file_field(gp.avatar),
            'bio': gp.bio or None,
            'location': gp.location or None,
            'platform': gp.platform or None,
        })
    return JsonResponse(data, safe=False)
