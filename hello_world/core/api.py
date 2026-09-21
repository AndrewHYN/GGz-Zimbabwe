from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.db.models import Count
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from accounts.models import GamerProfile, Notification, Post, Conversation, Message, ConversationParticipant
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
        data["is_following"] = profile.followers.filter(id=viewer.id).exists()
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
    posts = (
        Post.objects.select_related("author", "author__user", "game")
        .prefetch_related("likes", "comments")
        .order_by("-created_at")[:50]
    )

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

@require_GET
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
@require_http_methods(["GET", "POST"])
def api_conversation_detail(request, conversation_id):
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False}, status=401)
    try:
        profile = GamerProfile.objects.get(user=request.user)
        conversation = Conversation.objects.get(id=conversation_id)
    except (GamerProfile.DoesNotExist, Conversation.DoesNotExist):
        return JsonResponse({"error": "Not found"}, status=404)
    if request.method == "POST":
        import json
        try:
            body = json.loads(request.body)
            content = body.get("content", "").strip()
        except (json.JSONDecodeError, AttributeError):
            content = ""
        if not content:
            return JsonResponse({"error": "Content is required"}, status=400)
        other = next((p.profile for p in ConversationParticipant.objects.filter(conversation=conversation).exclude(profile=profile)), None)
        if not other:
            return JsonResponse({"error": "No other participant"}, status=404)
        message = Message.objects.create(conversation=conversation, sender=profile, recipient=other, content=content)
        return JsonResponse({"id": message.id, "sender": profile.gamer_tag, "content": message.content, "created_at": message.created_at.isoformat() if message.created_at else None})
    participants = list(ConversationParticipant.objects.filter(conversation=conversation).select_related("profile", "profile__user"))
    other = next((p.profile for p in participants if p.profile != profile), None)
    data = {
        "id": conversation.id,
        "other_participant": {
            "id": other.user.id if other and other.user else None,
            "username": other.user.username if other and other.user else None,
            "gamer_tag": other.gamer_tag if other else None,
            "avatar": _serialize_file_field(other.avatar) if other else None,
        },
        "messages": [],
    }
    return JsonResponse(data)


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
