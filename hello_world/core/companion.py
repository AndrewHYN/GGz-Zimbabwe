import json
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.db.models import Q
from django.urls import reverse

from accounts.models import GamerProfile
from accounts.models import Block
from events.models import Event
from games.models import Game
from marketplace.models import Listing
from tournaments.models import Tournament


class CompanionProvider:
    def respond(self, message, context):
        raise NotImplementedError


class LocalCompanionProvider(CompanionProvider):
    def respond(self, message, context):
        return context["reply"]


class OpenAICompatibleProvider(CompanionProvider):
    def respond(self, message, context):
        base_url = settings.AI_COMPANION_BASE_URL.rstrip("/")
        messages = [
            {
                "role": "system",
                "content": "You are GGz Companion. Use only the supplied GGz context. Never claim an action was completed unless the user completed it. Keep answers concise and useful.",
            },
        ]
        messages.extend(context.get("history", []))
        messages.append({"role": "user", "content": f"GGz context:\n{json.dumps(context['data'], default=str)}\n\nQuestion: {message}"})
        request = Request(
            f"{base_url}/chat/completions",
            data=json.dumps({
                "model": settings.AI_COMPANION_MODEL,
                "temperature": 0.3,
                "messages": messages,
            }).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {settings.AI_COMPANION_API_KEY}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=8) as response:
                payload = json.loads(response.read().decode("utf-8"))
            return payload["choices"][0]["message"]["content"].strip()
        except (HTTPError, URLError, KeyError, IndexError, json.JSONDecodeError, TimeoutError):
            return context["reply"]


def _provider():
    if settings.AI_COMPANION_PROVIDER.lower() in {"openai", "openai-compatible"} and settings.AI_COMPANION_API_KEY and settings.AI_COMPANION_BASE_URL:
        return OpenAICompatibleProvider()
    return LocalCompanionProvider()


def _terms(query):
    stop_words = {"a", "an", "and", "find", "for", "game", "help", "me", "recommend", "show", "the", "what"}
    return [term for term in query.lower().split() if len(term) > 2 and term not in stop_words]


def _search_games(query):
    terms = _terms(query) or [query]
    filters = Q()
    for term in terms:
        filters |= Q(name__icontains=term) | Q(genre__icontains=term)
    games = Game.objects.filter(filters).order_by("name")[:5]
    return [{"name": game.name, "genre": game.genre, "url": reverse("game_detail", args=[game.id])} for game in games]


def _search_profiles(query, viewer):
    terms = _terms(query) or [query]
    filters = Q()
    for term in terms:
        filters |= Q(gamer_tag__icontains=term) | Q(user__username__icontains=term) | Q(city__icontains=term)
    profiles = GamerProfile.objects.select_related("user").filter(filters).exclude(id=getattr(viewer, "id", None))
    if viewer:
        blocked_ids = Block.objects.filter(Q(blocker=viewer) | Q(blocked=viewer)).values_list("blocker_id", "blocked_id")
        profiles = profiles.exclude(id__in={profile_id for pair in blocked_ids for profile_id in pair})
    profiles = profiles.order_by("gamer_tag")[:5]
    return [{"gamer_tag": profile.gamer_tag, "city": profile.city, "url": reverse("profile_detail", args=[profile.gamer_tag])} for profile in profiles]


def _search_events(query):
    terms = _terms(query) or [query]
    filters = Q()
    for term in terms:
        filters |= Q(name__icontains=term) | Q(location__icontains=term) | Q(city__icontains=term)
    events = Event.objects.select_related("game").filter(
        filters,
        status__in=("Upcoming", "Live", "Published"),
    ).order_by("start_date")[:5]
    return [{"name": event.name, "game": event.game.name if event.game else "Community", "url": reverse("event_detail", args=[event.id])} for event in events]


def _search_tournaments(query):
    terms = _terms(query) or [query]
    filters = Q()
    for term in terms:
        filters |= Q(name__icontains=term) | Q(location__icontains=term) | Q(city__icontains=term)
    tournaments = Tournament.objects.select_related("game").filter(
        filters,
        status__in=("Registration Open", "Live", "Registration Closed"),
    ).order_by("start_date")[:5]
    return [{"name": tournament.name, "game": tournament.game.name if tournament.game else "Open", "url": reverse("tournament_detail", args=[tournament.slug])} for tournament in tournaments]


def _search_listings(query):
    terms = _terms(query) or [query]
    filters = Q()
    for term in terms:
        filters |= Q(title__icontains=term) | Q(category__icontains=term) | Q(location__icontains=term)
    listings = Listing.objects.filter(
        filters,
        status__in=("Available", "Reserved"),
    ).order_by("-created_at")[:5]
    return [{"title": listing.title, "price": str(listing.price), "url": reverse("listing_detail", args=[listing.id])} for listing in listings]


def build_context(message, user=None):
    query = (message or "").strip()
    lowered = query.lower()
    results = {}
    if any(term in lowered for term in ("game", "recommend", "play")):
        results["games"] = _search_games(query)
    if any(term in lowered for term in ("player", "gamer", "community", "squad")):
        results["profiles"] = _search_profiles(query, getattr(user, "gamer_profile", None))
    if any(term in lowered for term in ("event", "near", "local")):
        results["events"] = _search_events(query)
    if any(term in lowered for term in ("tournament", "bracket", "compete")):
        results["tournaments"] = _search_tournaments(query)
    if any(term in lowered for term in ("market", "listing", "buy", "sell")):
        results["listings"] = _search_listings(query)

    if results:
        labels = ", ".join(f"{len(items)} {kind}" for kind, items in results.items())
        reply = f"I searched the public GGz catalog and found {labels}. Use the links below to explore the results."
    elif any(term in lowered for term in ("how", "help", "what can", "navigate")):
        reply = "I can help you explore public games, players, tournaments, events, and marketplace listings. I can also explain profiles, messaging, notifications, and community features."
    else:
        reply = "Tell me what you want to find on GGz, such as a tournament, game, player, event, or marketplace listing."
    action = None
    follow_match = re.match(r"\s*follow\s+([A-Za-z0-9_]+)", query, re.IGNORECASE)
    if follow_match and user and getattr(user, "is_authenticated", False):
        candidate = GamerProfile.objects.filter(gamer_tag__iexact=follow_match.group(1)).first()
        if candidate and candidate.user_id != user.id:
            action = {
                "type": "follow",
                "label": f"Follow {candidate.gamer_tag}?",
                "url": reverse("connection_action", args=[candidate.gamer_tag, "follow"]),
                "target": candidate.gamer_tag,
            }
            reply = f"I found {candidate.gamer_tag}. I can prepare the follow action, but I will wait for your confirmation."
    return {"reply": reply, "data": results, "action": action}


def answer(message, user=None, history=None):
    context = build_context(message, user)
    context["history"] = [
        {"role": entry["role"], "content": entry["content"]}
        for entry in (history or [])
        if entry.get("role") in {"user", "assistant"} and isinstance(entry.get("content"), str)
    ][-10:]
    response = _provider().respond(message, context)
    return {"response": response, "results": context["data"], "action": context.get("action"), "provider": settings.AI_COMPANION_PROVIDER}
