from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.db.models import Count
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from accounts.models import Block, GamerProfile, Notification, Post, Conversation, Message, ConversationParticipant
from events.models import Event
from games.models import Game, GameReview, GameWishlist
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
    from django.shortcuts import get_object_or_404

    profile = get_object_or_404(
        GamerProfile.objects.select_related("user").prefetch_related("games"),
        gamer_tag=gamer_tag,
    )
    viewer = getattr(request.user, "gamer_profile", None) if request.user.is_authenticated else None
    presence = getattr(profile, "presence", None)

    data = {
        "id": profile.id,
        "gamer_tag": profile.gamer_tag,
        "username": profile.user.username,
        "avatar": _serialize_file_field(profile.avatar),
        "cover": _serialize_file_field(profile.cover),
        "bio": profile.bio,
        "location": profile.public_location_label,
        "city": profile.city,
        "province": profile.province,
        "country": profile.country,
        "platform": profile.platform,
        "rank": profile.rank,
        "availability": profile.availability,
        "respect_points": profile.respect_points,
        "respect_level": profile.respect_level,
        "tournament_wins": profile.tournament_wins,
        "matches_played": profile.matches_played,
        "match_wins": profile.match_wins,
        "win_percentage": profile.win_percentage,
        "follower_count": profile.followers.count(),
        "following_count": profile.following.count(),
        "is_following": False,
        "is_friend": False,
        "is_self": viewer == profile,
        "presence": presence.public_status(viewer_is_owner=viewer == profile) if presence else "offline",
        "games": [
            {
                "id": game.id,
                "name": game.name,
                "cover_art_url": game.cover_art_url or None,
                "platform": game.platform or None,
            }
            for game in profile.games.order_by("name")
        ],
    }

    if viewer and viewer != profile:
        data["is_following"] = profile.followers.filter(follower_id=viewer.id).exists()
        data["is_friend"] = (
            profile.friendships_as_one.filter(profile_two=viewer).exists()
            or profile.friendships_as_two.filter(profile_one=viewer).exists()
        )

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
        game = Game.objects.prefetch_related('reviews__reviewer').get(id=game_id)
    except Game.DoesNotExist:
        return JsonResponse({'error': 'Game not found'}, status=404)

    from games.views import _compute_game_stats

    from accounts.models import Block, ExternalFeedItem
    from accounts.views import _visible_posts

    viewer = getattr(request.user, 'gamer_profile', None) if request.user.is_authenticated else None
    blocked_ids = (
        {
            value
            for pair in Block.objects.filter(
                Q(blocker=viewer) | Q(blocked=viewer)
            ).values_list('blocker_id', 'blocked_id')
            for value in pair
        }
        if viewer
        else set()
    )
    reviews = list(game.reviews.select_related('reviewer').order_by('-created_at')[:20])
    user_review = (
        GameReview.objects.select_related('reviewer').filter(game=game, reviewer=viewer).first()
        if viewer
        else None
    )
    community_posts = list(
        _visible_posts(viewer).filter(game=game).select_related('author').order_by('-created_at')[:5]
    )
    available_players = list(
        game.players.exclude(id__in=blocked_ids).order_by('gamer_tag')[:8]
    )
    challengers = [
        {'id': player.id, 'gamer_tag': player.gamer_tag}
        for player in available_players
        if viewer is None or player.id != viewer.id
    ]
    upcoming_tournaments = list(
        game.tournaments.filter(status__in=('Registration Open', 'Registration Closed', 'Live')).order_by('start_date')[:4]
    )
    related_events = list(
        game.events.filter(status__in=('Upcoming', 'Published', 'Live')).order_by('start_date')[:4]
    )
    related_listings = list(
        game.listings.filter(status__in=('Available', 'Reserved')).select_related('seller').order_by('-created_at')[:4]
    )
    game_news = list(
        ExternalFeedItem.objects.filter(game=game, is_active=True).order_by('-published_at')[:4]
    )
    leaderboard = [
        {
            'gamer_tag': profile.gamer_tag,
            'avatar': _serialize_file_field(profile.avatar),
            'wins': wins,
            'matches': matches,
            'win_percentage': win_rate,
        }
        for profile, wins, matches, win_rate in _compute_game_stats(game)[:10]
    ]
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
        'trailer_embed_url': game.trailer_embed_url or None,
        'igdb_rating': float(game.igdb_rating) if game.igdb_rating else None,
        'average_rating': game.average_rating,
        'review_count': game.review_count,
        'user_review': (
            {
                'id': user_review.id,
                'rating': user_review.rating,
                'review': user_review.review,
                'created_at': user_review.created_at.isoformat() if user_review.created_at else None,
            }
            if user_review else None
        ),
        'reviews': [
            {
                'id': review.id,
                'reviewer': {
                    'gamer_tag': review.reviewer.gamer_tag,
                    'avatar': _serialize_file_field(review.reviewer.avatar),
                },
                'rating': review.rating,
                'review': review.review,
                'created_at': review.created_at.isoformat() if review.created_at else None,
            }
            for review in reviews
        ],
        'leaderboard': leaderboard,
        'is_wishlisted': bool(viewer and GameWishlist.objects.filter(profile=viewer, game=game).exists()),
        'wishlist_count': GameWishlist.objects.filter(game=game).count(),
        'igdb_url': game.igdb_url or None,
        'player_count_total': game.players.count(),
        'tournament_count': game.tournaments.filter(status__in=('Registration Open', 'Registration Closed', 'Live')).count(),
        'event_count': game.events.filter(status__in=('Upcoming', 'Published', 'Live')).count(),
        'available_players': [
            {'gamer_tag': player.gamer_tag, 'avatar': _serialize_file_field(player.avatar)}
            for player in available_players
        ],
        'challengers': challengers,
        'community_posts': [
            {
                'id': post.id,
                'author': {'gamer_tag': post.author.gamer_tag},
                'content': post.body[:220],
                'like_count': post.likes.count(),
                'comment_count': post.comments.count(),
                'created_at': post.created_at.isoformat() if post.created_at else None,
            }
            for post in community_posts
        ],
        'upcoming_tournaments': [
            {'id': tournament.id, 'name': tournament.name, 'slug': tournament.slug, 'status': tournament.status}
            for tournament in upcoming_tournaments
        ],
        'related_events': [
            {'id': event.id, 'name': event.name, 'status': event.status}
            for event in related_events
        ],
        'related_listings': [
            {'id': listing.id, 'title': listing.title, 'price': str(listing.price)}
            for listing in related_listings
        ],
        'game_news': [
            {
                'title': item.title,
                'source_name': item.source_name,
                'url': item.url,
                'image_url': item.image_url or None,
                'published_at': item.published_at.isoformat() if item.published_at else None,
            }
            for item in game_news
        ],
    }
    return JsonResponse(data)


@require_POST
def api_game_review_create(request, game_id):
    import json

    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)
    try:
        game = Game.objects.get(id=game_id)
    except Game.DoesNotExist:
        return JsonResponse({'error': 'Game not found'}, status=404)
    try:
        profile = GamerProfile.objects.get(user=request.user)
    except GamerProfile.DoesNotExist:
        return JsonResponse({'error': 'Profile not found'}, status=404)
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError, AttributeError):
        return JsonResponse({'ok': False, 'error': 'Invalid request.'}, status=400)
    try:
        rating_value = int(payload.get('rating'))
    except (TypeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Select a rating between 1 and 5.'}, status=400)
    if rating_value not in {1, 2, 3, 4, 5}:
        return JsonResponse({'ok': False, 'error': 'Select a rating between 1 and 5.'}, status=400)
    review_text = str(payload.get('review') or '').strip()
    review, created = GameReview.objects.get_or_create(
        game=game, reviewer=profile, defaults={'rating': rating_value, 'review': review_text}
    )
    review.rating = rating_value
    review.review = review_text
    review.save()
    game.refresh_from_db()
    return JsonResponse({
        'ok': True,
        'created': created,
        'average_rating': game.average_rating,
        'review_count': game.review_count,
        'review': {
            'id': review.id,
            'rating': review.rating,
            'review': review.review,
            'created_at': review.created_at.isoformat() if review.created_at else None,
        },
    }, status=201 if created else 200)


@require_POST
def api_game_challenge_create(request, game_id):
    import json

    from django.db.models import Q
    from django.utils.dateparse import parse_datetime
    from django.utils import timezone
    from tournaments.models import Challenge

    from accounts.views import _rate_limit_exceeded

    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)
    try:
        game = Game.objects.get(id=game_id)
    except Game.DoesNotExist:
        return JsonResponse({'error': 'Game not found'}, status=404)
    try:
        profile = GamerProfile.objects.get(user=request.user)
    except GamerProfile.DoesNotExist:
        return JsonResponse({'error': 'Profile not found'}, status=404)
    if _rate_limit_exceeded(request, 'challenge', 20):
        return JsonResponse({'ok': False, 'error': 'Too many challenges sent. Please slow down.'}, status=429)
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError, AttributeError):
        return JsonResponse({'ok': False, 'error': 'Invalid request.'}, status=400)
    opponent_id = payload.get('opponent')
    try:
        opponent = GamerProfile.objects.filter(
            Q(games=game) | Q(team_memberships__team__game=game)
        ).distinct().get(id=opponent_id)
    except (GamerProfile.DoesNotExist, TypeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Choose an eligible friend to challenge.'}, status=400)
    if opponent == profile:
        return JsonResponse({'ok': False, 'error': 'You cannot challenge yourself.'}, status=400)
    if Block.objects.filter(Q(blocker=profile, blocked=opponent) | Q(blocker=opponent, blocked=profile)).exists():
        return JsonResponse({'ok': False, 'error': 'You cannot challenge this player.'}, status=403)
    scheduled_at = payload.get('scheduled_at') or None
    if scheduled_at:
        scheduled_at = parse_datetime(scheduled_at)
        if scheduled_at and timezone.is_naive(scheduled_at):
            scheduled_at = timezone.make_aware(scheduled_at, timezone.get_current_timezone())
    challenge, created = Challenge.objects.get_or_create(
        challenger=profile,
        opponent=opponent,
        game=game,
        status='Pending',
        defaults={'scheduled_at': scheduled_at},
    )
    if not created:
        return JsonResponse({'ok': True, 'created': False, 'message': 'You already have a pending challenge for this player.'})
    from accounts.models import notify
    notify(opponent, profile, 'challenge', f'{profile.gamer_tag} challenged you', f'/games/{game.id}/')
    return JsonResponse({'ok': True, 'created': True, 'message': 'Challenge sent.'}, status=201)


@require_POST
def api_game_wishlist_toggle(request, game_id):
    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)
    try:
        game = Game.objects.get(id=game_id)
    except Game.DoesNotExist:
        return JsonResponse({'error': 'Game not found'}, status=404)
    try:
        profile = GamerProfile.objects.get(user=request.user)
    except GamerProfile.DoesNotExist:
        return JsonResponse({'error': 'Profile not found'}, status=404)
    wishlist_item = GameWishlist.objects.filter(game=game, profile=profile).first()
    if wishlist_item:
        wishlist_item.delete()
        wishlisted = False
    else:
        GameWishlist.objects.create(game=game, profile=profile)
        wishlisted = True
    return JsonResponse({
        'ok': True,
        'wishlisted': wishlisted,
        'wishlist_count': GameWishlist.objects.filter(game=game).count(),
    })


@require_GET
def api_tournaments_list(request):
    tournaments = Tournament.objects.select_related('game', 'organizer').prefetch_related('registrations').all()
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
            'registration_deadline': t.registration_deadline.isoformat() if t.registration_deadline else None,
            'location': t.location or None,
            'mode': t.mode,
            'entry_type': t.entry_type,
            'max_participants': t.max_participants,
            'participant_count': t.registrations.filter(status='Registered').count(),
            'prize_description': t.prize_description or None,
            'organizer_name': t.organizer.gamer_tag if t.organizer else None,
        })
    return JsonResponse(data, safe=False)


@require_GET
def api_events_list(request):
    events = Event.objects.select_related('game', 'organization').prefetch_related('rsvps').all()
    data = []
    for e in events:
        data.append({
            'id': e.id,
            'name': e.name,
            'description': e.description or None,
            'start_date': e.start_date.isoformat() if e.start_date else None,
            'location': e.location or None,
            'city': e.city or None,
            'province': e.province or None,
            'country': e.country or None,
            'mode': e.mode,
            'status': e.status,
            'banner': _serialize_file_field(e.banner),
            'game_name': e.game.name if e.game else None,
            'organization_name': e.organization.name if e.organization else None,
            'organizer_name': e.organizer.gamer_tag if e.organizer else None,
            'rsvp_count': e.rsvps.count(),
            'capacity': e.capacity,
        })
    return JsonResponse(data, safe=False)


@require_GET
def api_teams_list(request):
    teams = Team.objects.select_related('game', 'owner').prefetch_related('memberships').all()
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
            'game_name': team.game.name if team.game else None,
            'logo': _serialize_file_field(team.logo),
            'member_count': team.memberships.count(),
            'wins': team.wins,
            'losses': team.losses,
            'matches_played': team.matches_played,
            'win_rate': team.win_rate,
        })
    return JsonResponse(data, safe=False)


@require_GET
def api_marketplace_list(request):
    listings = (
        Listing.objects.select_related('seller', 'game')
        .prefetch_related('images', 'saves')
        .filter(status__in=('Available', 'Reserved'))
    )
    category = request.GET.get('category', '').strip()
    if category:
        listings = listings.filter(category__icontains=category)
    condition = request.GET.get('condition', '').strip()
    if condition:
        listings = listings.filter(condition__icontains=condition)
    data = []
    for listing in listings:
        first_image = next(iter(listing.images.all()), None)
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
            'seller_avatar': _serialize_file_field(listing.seller.avatar) if listing.seller else None,
            'image': _serialize_file_field(first_image.image) if first_image else None,
            'save_count': listing.saves.count(),
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
        return JsonResponse({"authenticated": False}, status=401)

    try:
        profile = GamerProfile.objects.get(user=request.user)
    except GamerProfile.DoesNotExist:
        return JsonResponse([], safe=False)

    notifications = (
        Notification.objects.filter(recipient=profile)
        .select_related("actor")
        .order_by("-created_at")[:100]
    )

    data = []
    for n in notifications:
        data.append({
            "id": n.id,
            "actor": {
                "gamer_tag": n.actor.gamer_tag if n.actor else "GGz",
                "avatar": _serialize_file_field(n.actor.avatar) if n.actor else None,
            },
            "notification_type": n.notification_type,
            "message": n.message,
            "target_url": n.target_url or None,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        })
    return JsonResponse(data, safe=False)

@require_GET
def api_feed_list(request):
    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)

    viewer = getattr(request.user, "gamer_profile", None)
    from accounts.views import _visible_posts
    posts = _visible_posts(viewer).order_by("-created_at")[:50]

    data = []
    for post in posts:
        profile = post.author
        author_data = {
            'gamer_tag': profile.gamer_tag,
            'avatar': _serialize_file_field(profile.avatar),
        }

        data.append({
            "id": post.id,
            "author": author_data,
            "content": post.body,
            "created_at": post.created_at.isoformat() if post.created_at else None,
            "like_count": post.likes.count(),
            "comment_count": post.comments.count(),
            "liked": bool(viewer and post.likes.filter(user=viewer).exists()),
            "saved": bool(viewer and post.saved_by.filter(user=viewer).exists()),
            "image": _serialize_file_field(post.image),
            "game": post.game.name if post.game else None,
        })
    return JsonResponse(data, safe=False)


@require_GET
def api_conversations_list(request):
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False}, status=401)

    try:
        profile = GamerProfile.objects.get(user=request.user)
    except GamerProfile.DoesNotExist:
        return JsonResponse([], safe=False)

    participants = ConversationParticipant.objects.filter(
        profile=profile
    ).select_related("conversation")

    data = []
    for participant in participants:
        conversation = participant.conversation
        other = (
            ConversationParticipant.objects.filter(conversation=conversation)
            .select_related("profile", "profile__user")
            .exclude(profile=profile)
            .first()
        )
        if other is None:
            continue

        last_message = conversation.messages.order_by("-created_at").first()
        unread = conversation.messages.filter(sender=other.profile)
        if participant.last_read_at:
            unread = unread.filter(created_at__gt=participant.last_read_at)

        data.append({
            "id": conversation.id,
            "other_participant": {
                "id": other.profile.user.id if other.profile.user else other.profile.id,
                "username": other.profile.user.username if other.profile.user else other.profile.gamer_tag,
                "gamer_tag": other.profile.gamer_tag,
                "avatar": _serialize_file_field(other.profile.avatar),
            },
            "last_message": last_message.body if last_message else "",
            "last_message_time": last_message.created_at.isoformat() if last_message else conversation.updated_at.isoformat(),
            "unread_count": unread.count(),
            "updated_at": conversation.updated_at.isoformat(),
        })

    data.sort(key=lambda item: item["updated_at"], reverse=True)
    return JsonResponse(data, safe=False)

@require_GET
def api_gamers_list(request):
    gamers = (
        GamerProfile.objects.select_related("user")
        .prefetch_related("games")
        .order_by("-respect_points", "gamer_tag")
    )
    data = []
    for gp in gamers:
        presence = getattr(gp, "presence", None)
        data.append({
            "id": gp.id,
            "gamer_tag": gp.gamer_tag,
            "username": gp.user.username,
            "avatar": _serialize_file_field(gp.avatar),
            "bio": gp.bio or None,
            "location": gp.public_location_label,
            "platform": gp.platform or None,
            "rank": gp.rank,
            "availability": gp.availability,
            "respect_points": gp.respect_points,
            "respect_level": gp.respect_level,
            "tournament_wins": gp.tournament_wins,
            "matches_played": gp.matches_played,
            "match_wins": gp.match_wins,
            "win_percentage": gp.win_percentage,
            "presence": presence.public_status() if presence else "offline",
            "game_count": gp.games.count(),
        })
    return JsonResponse(data, safe=False)

@require_http_methods(["GET", "POST"])
def api_notifications_mark_all_read(request):
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False}, status=401)
    try:
        profile = GamerProfile.objects.get(user=request.user)
    except GamerProfile.DoesNotExist:
        return JsonResponse({"ok": False}, status=404)
    Notification.objects.filter(recipient=profile, is_read=False).update(is_read=True)
    return JsonResponse({"ok": True})


@require_http_methods(["GET", "POST"])
def api_conversation_detail(request, conversation_id):
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False}, status=401)

    try:
        profile = GamerProfile.objects.get(user=request.user)
        conversation = Conversation.objects.get(id=conversation_id)
    except (GamerProfile.DoesNotExist, Conversation.DoesNotExist):
        return JsonResponse({"error": "Not found"}, status=404)

    member = ConversationParticipant.objects.filter(
        conversation=conversation,
        profile=profile,
    ).first()
    if member is None:
        return JsonResponse({"error": "Forbidden"}, status=403)

    if request.method == "POST":
        import json

        try:
            payload = json.loads(request.body)
        except (json.JSONDecodeError, TypeError):
            payload = {}

        content = str(payload.get("content", "")).strip()
        client_id = str(payload.get("client_id", "")).strip()[:64] or None
        if not content:
            return JsonResponse({"error": "Content is required"}, status=400)

        other = (
            ConversationParticipant.objects.filter(conversation=conversation)
            .exclude(profile=profile)
            .select_related("profile")
            .first()
        )
        if other is None:
            return JsonResponse({"error": "No other participant"}, status=404)

        if client_id:
            existing = Message.objects.filter(
                conversation=conversation,
                client_id=client_id,
            ).first()
            if existing:
                return JsonResponse({
                    "id": existing.id,
                    "sender": existing.sender.gamer_tag,
                    "content": existing.body,
                    "created_at": existing.created_at.isoformat(),
                })

        message = Message.objects.create(
            conversation=conversation,
            sender=profile,
            body=content,
            client_id=client_id,
        )
        return JsonResponse({
            "id": message.id,
            "sender": profile.gamer_tag,
            "content": message.body,
            "created_at": message.created_at.isoformat() if message.created_at else None,
            "is_read": False,
        }, status=201)

    participants = list(
        ConversationParticipant.objects.filter(conversation=conversation)
        .select_related("profile", "profile__user")
    )
    other = next((p.profile for p in participants if p.profile != profile), None)

    messages = list(
        conversation.messages.select_related("sender").order_by("-created_at")[:100]
    )
    messages.reverse()

    member.last_read_at = timezone.now()
    member.save(update_fields=["last_read_at"])

    return JsonResponse({
        "id": conversation.id,
        "other_participant": {
            "id": other.user.id if other and other.user else None,
            "username": other.user.username if other and other.user else (other.gamer_tag if other else None),
            "gamer_tag": other.gamer_tag if other else None,
            "avatar": _serialize_file_field(other.avatar) if other else None,
        },
        "messages": [
            {
                "id": message.id,
                "sender": message.sender.gamer_tag,
                "content": message.body,
                "created_at": message.created_at.isoformat() if message.created_at else None,
                "delivered_at": message.delivered_at.isoformat() if message.delivered_at else None,
                "read_at": message.read_at.isoformat() if message.read_at else None,
                "is_read": message.read_at is not None,
            }
            for message in messages
        ],
    })

@require_GET
def api_map_data(request):
    from accounts.views import map_data
    return map_data(request)

@require_GET
def api_leaderboards(request):
    game_id = request.GET.get("game")
    if game_id:
        try:
            game = Game.objects.get(id=game_id)
        except Game.DoesNotExist:
            return JsonResponse({"error": "Game not found"}, status=404)

        from games.views import _compute_game_stats

        entries = []
        for rank, row in enumerate(_compute_game_stats(game), start=1):
            profile, wins, matches, win_rate = row
            entries.append({
                "rank": rank,
                "gamer_tag": profile.gamer_tag,
                "avatar": _serialize_file_field(profile.avatar),
                "wins": wins,
                "matches": matches,
                "win_percentage": win_rate,
                "game": game.name,
            })
        return JsonResponse({"mode": "game", "game": game.name, "results": entries})

    profiles = (
        GamerProfile.objects.select_related("user")
        .annotate(game_count=Count("games", distinct=True))
        .order_by("-respect_points", "-tournament_wins", "-game_count", "gamer_tag")[:50]
    )
    return JsonResponse({
        "mode": "global",
        "results": [
            {
                "rank": index,
                "gamer_tag": profile.gamer_tag,
                "avatar": _serialize_file_field(profile.avatar),
                "respect_points": profile.respect_points,
                "tournament_wins": profile.tournament_wins,
                "game_count": profile.game_count,
                "rank_label": profile.rank,
            }
            for index, profile in enumerate(profiles, start=1)
        ],
    })
@require_POST
def api_conversation_send_message(request, conversation_id):
    return api_conversation_detail(request, conversation_id)


@require_POST
def api_profile_connection(request, gamer_tag, action):
    from accounts.views import connection_action
    return connection_action(request, gamer_tag, action)


@require_POST
def api_feed_like(request, post_id):
    from accounts.views import post_like
    return post_like(request, post_id)


@require_POST
def api_feed_save(request, post_id):
    from accounts.views import post_save_toggle
    return post_save_toggle(request, post_id)


@require_POST
def api_feed_report(request, post_id):
    from accounts.views import post_report
    return post_report(request, post_id)


@require_POST
def api_notification_read(request, notification_id):
    from accounts.views import notification_read
    return notification_read(request, notification_id)


@require_POST
def api_message_request_action(request, gamer_tag, action):
    from accounts.views import message_request_action
    return message_request_action(request, gamer_tag, action)


@require_POST
def api_conversation_start(request, gamer_tag):
    from accounts.views import conversation_start
    return conversation_start(request, gamer_tag)


@require_POST
def api_feed_create(request):
    from accounts.views import post_create
    return post_create(request)


@require_POST
def api_profile_game_add(request, gamer_tag):
    from accounts.views import profile_game_add
    return profile_game_add(request, gamer_tag)


@require_POST
def api_profile_game_remove(request, gamer_tag, game_id):
    from accounts.views import profile_game_remove
    return profile_game_remove(request, gamer_tag, game_id)


@require_GET
def api_tournament_detail(request, slug):
    from tournaments.models import TournamentRegistration

    try:
        tournament = (
            Tournament.objects.select_related('game', 'organizer')
            .prefetch_related('registrations__player')
            .get(slug=slug)
        )
    except Tournament.DoesNotExist:
        return JsonResponse({'error': 'Tournament not found'}, status=404)
    viewer = getattr(request.user, 'gamer_profile', None) if request.user.is_authenticated else None
    registration = None
    if viewer:
        registration = TournamentRegistration.objects.filter(tournament=tournament, player=viewer).first()
    participants = [
        {
            'gamer_tag': reg.player.gamer_tag,
            'avatar': _serialize_file_field(reg.player.avatar),
            'status': reg.status,
        }
        for reg in tournament.registrations.select_related('player').filter(status='Registered').order_by('joined_at')
    ]
    matches = [
        {
            'id': match.id,
            'round': match.round,
            'status': match.status,
            'score': match.score or None,
            'player_one': match.player_one.gamer_tag if match.player_one else None,
            'player_two': match.player_two.gamer_tag if match.player_two else None,
            'winner': match.winner.gamer_tag if match.winner else None,
        }
        for match in tournament.matches.select_related('player_one', 'player_two', 'winner').order_by('round', 'id')
    ]
    registered_count = tournament.registrations.filter(status='Registered').count()
    return JsonResponse({
        'id': tournament.id,
        'name': tournament.name,
        'slug': tournament.slug,
        'description': tournament.description or None,
        'rules': tournament.rules or None,
        'format': tournament.format,
        'status': tournament.status,
        'mode': tournament.mode,
        'entry_type': tournament.entry_type,
        'prize_description': tournament.prize_description or None,
        'game_name': tournament.game.name if tournament.game else None,
        'location': tournament.location or None,
        'city': tournament.city or None,
        'province': tournament.province or None,
        'country': tournament.country or None,
        'start_date': tournament.start_date.isoformat() if tournament.start_date else None,
        'registration_deadline': tournament.registration_deadline.isoformat() if tournament.registration_deadline else None,
        'max_participants': tournament.max_participants,
        'participant_count': registered_count,
        'organizer': {
            'gamer_tag': tournament.organizer.gamer_tag if tournament.organizer else None,
            'avatar': _serialize_file_field(tournament.organizer.avatar) if tournament.organizer else None,
        },
        'is_organizer': bool(viewer and tournament.organizer_id == viewer.id),
        'registration_status': registration.status if registration else None,
        'participants': participants,
        'matches': matches,
    })


@require_POST
def api_tournament_register(request, slug):
    from tournaments.views import tournament_register
    return tournament_register(request, slug)


@require_POST
def api_tournament_leave(request, slug):
    from tournaments.views import tournament_leave
    return tournament_leave(request, slug)


@require_GET
def api_event_detail(request, event_id):
    try:
        event = (
            Event.objects.select_related('organizer', 'game', 'organization')
            .prefetch_related('rsvps__attendee')
            .get(id=event_id)
        )
    except Event.DoesNotExist:
        return JsonResponse({'error': 'Event not found'}, status=404)
    profile = getattr(request.user, 'gamer_profile', None) if request.user.is_authenticated else None
    rsvp_count = event.rsvps.count()
    return JsonResponse({
        'id': event.id,
        'name': event.name,
        'description': event.description or None,
        'start_date': event.start_date.isoformat() if event.start_date else None,
        'location': event.location or None,
        'city': event.city or None,
        'province': event.province or None,
        'country': event.country or None,
        'mode': event.mode,
        'status': event.status,
        'banner': _serialize_file_field(event.banner),
        'capacity': event.capacity,
        'rsvp_count': rsvp_count,
        'spots_remaining': None if not event.capacity else max(event.capacity - rsvp_count, 0),
        'game_name': event.game.name if event.game else None,
        'organization_name': event.organization.name if event.organization else None,
        'organizer': {
            'gamer_tag': event.organizer.gamer_tag if event.organizer else None,
            'avatar': _serialize_file_field(event.organizer.avatar) if event.organizer else None,
        },
        'is_organizer': bool(profile and event.organizer_id == profile.id),
        'is_rsvped': bool(profile and event.rsvps.filter(attendee=profile).exists()),
        'attendees': [
            {'gamer_tag': rsvp.attendee.gamer_tag, 'avatar': _serialize_file_field(rsvp.attendee.avatar)}
            for rsvp in event.rsvps.select_related('attendee')[:50]
        ],
    })


@require_POST
def api_event_rsvp(request, event_id):
    from events.views import event_rsvp
    return event_rsvp(request, event_id)


@require_POST
def api_event_leave(request, event_id):
    from events.views import event_leave
    return event_leave(request, event_id)


@require_GET
def api_team_detail(request, slug):
    from teams.models import TeamMembership

    try:
        team = Team.objects.select_related('owner', 'game').prefetch_related('memberships__player__user').get(slug=slug)
    except Team.DoesNotExist:
        return JsonResponse({'error': 'Team not found'}, status=404)
    viewer = getattr(request.user, 'gamer_profile', None) if request.user.is_authenticated else None
    roster = [
        {
            'gamer_tag': membership.player.gamer_tag,
            'avatar': _serialize_file_field(membership.player.avatar),
            'role': membership.role,
            'is_owner': membership.player_id == team.owner_id,
        }
        for membership in team.memberships.select_related('player').order_by('role', 'player__gamer_tag')
    ]
    viewer_role = next((entry['role'] for entry in roster if viewer and entry['gamer_tag'] == viewer.gamer_tag), None)
    is_manager = bool(
        viewer
        and (team.owner_id == viewer.id or TeamMembership.objects.filter(team=team, player=viewer, role='Captain').exists())
    )
    return JsonResponse({
        'id': team.id,
        'name': team.name,
        'tag': team.tag,
        'slug': team.slug,
        'description': team.description or None,
        'location': team.location or None,
        'status': team.status,
        'game_name': team.game.name if team.game else None,
        'logo': _serialize_file_field(team.logo),
        'banner': _serialize_file_field(team.banner),
        'owner_gamer_tag': team.owner.gamer_tag if team.owner else None,
        'member_count': team.memberships.count(),
        'wins': team.wins,
        'losses': team.losses,
        'matches_played': team.matches_played,
        'win_rate': team.win_rate,
        'roster': roster,
        'viewer_role': viewer_role,
        'is_manager': is_manager,
        'is_member': viewer_role is not None,
    })


@require_POST
def api_team_create(request):
    from django.utils.text import slugify
    from teams.forms import TeamForm
    from teams.models import TeamMembership

    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)
    try:
        profile = GamerProfile.objects.get(user=request.user)
    except GamerProfile.DoesNotExist:
        return JsonResponse({'error': 'Profile not found'}, status=404)
    form = TeamForm(request.POST, request.FILES or None)
    if not form.is_valid():
        return JsonResponse({'ok': False, 'errors': form.errors.get_json_data()}, status=400)
    team = form.save(commit=False)
    team.owner = profile
    team.slug = slugify(team.name)
    team.save()
    TeamMembership.objects.create(team=team, player=profile, role='Captain')
    return JsonResponse({'ok': True, 'slug': team.slug, 'id': team.id}, status=201)


@require_POST
def api_marketplace_save(request, listing_id):
    from marketplace.views import listing_save
    return listing_save(request, listing_id)


@require_POST
def api_marketplace_report(request, listing_id):
    from marketplace.views import listing_report
    return listing_report(request, listing_id)


@require_POST
def api_marketplace_contact(request, listing_id):
    from marketplace.views import contact_seller
    return contact_seller(request, listing_id)


@require_GET
def api_marketplace_detail(request, listing_id):
    from marketplace.models import SavedListing

    try:
        listing = (
            Listing.objects.select_related('seller__user', 'game')
            .prefetch_related('images')
            .get(id=listing_id)
        )
    except Listing.DoesNotExist:
        return JsonResponse({'error': 'Listing not found'}, status=404)
    viewer = getattr(request.user, 'gamer_profile', None) if request.user.is_authenticated else None
    return JsonResponse({
        'id': listing.id,
        'title': listing.title,
        'description': listing.description or None,
        'category': listing.category,
        'price': str(listing.price),
        'condition': listing.condition,
        'location': listing.location,
        'platform': listing.platform or None,
        'status': listing.status,
        'game_name': listing.game.name if listing.game else None,
        'created_at': listing.created_at.isoformat() if listing.created_at else None,
        'images': [_serialize_file_field(image.image) for image in listing.images.all()],
        'seller': {
            'gamer_tag': listing.seller.gamer_tag if listing.seller else None,
            'avatar': _serialize_file_field(listing.seller.avatar) if listing.seller else None,
        },
        'is_owner': bool(viewer and listing.seller_id == viewer.id),
        'is_saved': bool(viewer and SavedListing.objects.filter(user=viewer, listing=listing).exists()),
        'save_count': listing.saves.count(),
    })


@require_GET
def api_feed_detail(request, post_id):
    from accounts.models import PostLike, PostSave
    from accounts.views import _visible_posts

    viewer = getattr(request.user, 'gamer_profile', None) if request.user.is_authenticated else None
    post = _visible_posts(viewer).select_related('author', 'author__user', 'game').filter(id=post_id).first()
    if post is None:
        return JsonResponse({'error': 'Post not found'}, status=404)
    comments = [
        {
            'id': comment.id,
            'author': {
                'gamer_tag': comment.author.gamer_tag,
                'avatar': _serialize_file_field(comment.author.avatar),
            },
            'body': comment.body,
            'created_at': comment.created_at.isoformat() if comment.created_at else None,
        }
        for comment in post.comments.select_related('author').order_by('created_at')
    ]
    return JsonResponse({
        'id': post.id,
        'author': {
            'gamer_tag': post.author.gamer_tag,
            'avatar': _serialize_file_field(post.author.avatar),
        },
        'content': post.body,
        'created_at': post.created_at.isoformat() if post.created_at else None,
        'like_count': post.likes.count(),
        'comment_count': post.comments.count(),
        'liked': bool(viewer and PostLike.objects.filter(post=post, user=viewer).exists()),
        'saved': bool(viewer and PostSave.objects.filter(post=post, user=viewer).exists()),
        'image': _serialize_file_field(post.image),
        'game': post.game.name if post.game else None,
        'comments': comments,
    })


@require_POST
def api_feed_comment_create(request, post_id):
    import json

    from accounts.models import Comment
    from accounts.views import _notify, _visible_posts

    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)
    viewer = getattr(request.user, 'gamer_profile', None)
    if viewer is None:
        return JsonResponse({'error': 'Profile not found'}, status=404)
    post = _visible_posts(viewer).filter(id=post_id).first()
    if post is None:
        return JsonResponse({'error': 'Post not found'}, status=404)
    try:
        payload = json.loads(request.body)
        body = str(payload.get('body', '')).strip()
    except (json.JSONDecodeError, TypeError, AttributeError):
        body = ''
    if not body:
        return JsonResponse({'ok': False, 'error': 'Comment text is required.'}, status=400)
    if len(body) > 1000:
        return JsonResponse({'ok': False, 'error': 'Comments are limited to 1000 characters.'}, status=400)
    comment = Comment.objects.create(post=post, author=viewer, body=body)
    if post.author != viewer:
        _notify(post.author, viewer, 'comment', f'{viewer.gamer_tag} commented on your post', f'/feed/posts/{post.id}/')
    return JsonResponse({
        'ok': True,
        'comment': {
            'id': comment.id,
            'author': {'gamer_tag': viewer.gamer_tag, 'avatar': _serialize_file_field(viewer.avatar)},
            'body': comment.body,
            'created_at': comment.created_at.isoformat() if comment.created_at else None,
        },
        'comment_count': post.comments.count(),
    }, status=201)


@require_POST
def api_presence_update(request):
    import json

    from accounts.models import GamerPresence

    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)
    try:
        profile = GamerProfile.objects.get(user=request.user)
    except GamerProfile.DoesNotExist:
        return JsonResponse({'error': 'Profile not found'}, status=404)
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError, AttributeError):
        return JsonResponse({'ok': False, 'error': 'Invalid request.'}, status=400)
    presence, _ = GamerPresence.objects.get_or_create(profile=profile)
    presence.show_online_status = bool(payload.get('show_online_status', presence.show_online_status))
    presence.show_last_seen = bool(payload.get('show_last_seen', presence.show_last_seen))
    presence.save(update_fields=('show_online_status', 'show_last_seen', 'updated_at'))
    return JsonResponse({'ok': True, 'show_online_status': presence.show_online_status, 'show_last_seen': presence.show_last_seen})


@require_GET
def api_data_export(request):
    from accounts.models import Block

    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)
    try:
        profile = GamerProfile.objects.get(user=request.user)
    except GamerProfile.DoesNotExist:
        return JsonResponse({'error': 'Profile not found'}, status=404)
    data = {
        'user': {'username': request.user.username, 'email': request.user.email, 'date_joined': request.user.date_joined.isoformat()},
        'profile': {'gamer_tag': profile.gamer_tag, 'bio': profile.bio, 'location': profile.location, 'platform': profile.platform, 'rank': profile.get_rank_display(), 'availability': profile.get_availability_display(), 'matches_played': profile.matches_played, 'match_wins': profile.match_wins, 'tournament_wins': profile.tournament_wins, 'respect_points': profile.respect_points, 'created_at': profile.created_at.isoformat()},
        'posts': list(Post.objects.filter(author=profile).values('id', 'body', 'game_id', 'created_at')),
        'connections': {
            'followers': list(profile.followers.values_list('follower__gamer_tag', flat=True)),
            'following': list(profile.following.values_list('following__gamer_tag', flat=True)),
            'friends': sorted(
                set(profile.friendships_as_one.values_list('profile_two__gamer_tag', flat=True))
                | set(profile.friendships_as_two.values_list('profile_one__gamer_tag', flat=True))
            ),
        },
        'blocks': list(Block.objects.filter(blocker=profile).values_list('blocked__gamer_tag', flat=True)),
        'listings': list(Listing.objects.filter(seller=profile).values('id', 'title', 'description', 'price', 'status', 'created_at')),
    }
    response = JsonResponse(data, json_dumps_params={'indent': 2, 'default': str})
    response['Content-Disposition'] = f'attachment; filename="ggz-data-export-{request.user.username}.json"'
    return response


@require_GET
def api_security_overview(request):
    from accounts.models import GamerPresence, SocialIdentity
    from accounts.views import _provider_is_configured

    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)
    try:
        profile = GamerProfile.objects.get(user=request.user)
    except GamerProfile.DoesNotExist:
        return JsonResponse({'error': 'Profile not found'}, status=404)
    providers = []
    for provider in ('google', 'apple', 'discord'):
        identity = SocialIdentity.objects.filter(user=request.user, provider=provider).first()
        providers.append({
            'provider': provider,
            'name': provider.title(),
            'connected': bool(identity),
            'display_name': identity.display_name if identity else '',
            'available': _provider_is_configured(provider),
        })
    presence, _ = GamerPresence.objects.get_or_create(profile=profile)
    return JsonResponse({
        'username': request.user.username,
        'email': request.user.email,
        'providers': providers,
        'presence': {
            'show_online_status': presence.show_online_status,
            'show_last_seen': presence.show_last_seen,
        },
    })
