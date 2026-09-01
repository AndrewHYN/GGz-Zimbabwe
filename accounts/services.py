import hashlib
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone as dt_timezone
from email.utils import parsedate_to_datetime
from urllib.request import Request, urlopen

from django.utils import timezone

from games.models import Game

from .models import ExternalFeedItem

PUBLIC_GAMING_SOURCES = [
    {
        "name": "Steam News",
        "url": "https://store.steampowered.com/feeds/news.xml",
        "kind": "rss",
        "keywords": ["steam", "game", "update", "patch"],
    },
    {
        "name": "Gamespot",
        "url": "https://www.gamespot.com/feeds/news/",
        "kind": "rss",
        "keywords": ["mortal kombat", "tekken", "fortnite", "valorant", "call of duty", "fc", "marvel rivals", "gta"],
    },
    {
        "name": "PlayStation Blog",
        "url": "https://blog.playstation.com/feed/",
        "kind": "rss",
        "keywords": ["mortal kombat", "tekken", "fortnite", "valorant", "call of duty", "fc", "marvel rivals", "gta"],
    },
    {
        "name": "Nexus.gg",
        "url": "https://www.nexus.gg/rss",
        "kind": "rss",
        "keywords": ["valorant", "fortnite", "call of duty", "fc", "marvel rivals", "gta"],
    },
]


def _coerce_text(element):
    if element is None:
        return ""
    text = "".join(element.itertext()).strip()
    return re.sub(r"\s+", " ", text)


def _find_child(node, *names):
    for name in names:
        result = node.find(name)
        if result is not None:
            return result
        result = node.find(f"{{*}}{name}")
        if result is not None:
            return result
    return None


def _find_text(node, *names):
    child = _find_child(node, *names)
    return _coerce_text(child) if child is not None else ""


def _find_attr(node, attr_name, *names):
    for name in names:
        child = _find_child(node, name)
        if child is not None and child.attrib.get(attr_name):
            return child.attrib.get(attr_name)
        if child is not None and child.text:
            return child.text
    return ""


def _parse_published_date(value):
    if not value:
        return None
    cleaned = value.strip()
    try:
        parsed = parsedate_to_datetime(cleaned)
        if parsed.tzinfo is None:
            return timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed.astimezone(dt_timezone.utc)
    except (TypeError, ValueError, IndexError):
        pass

    for pattern in ("%a, %d %b %Y %H:%M:%S %z", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S"):
        try:
            parsed = datetime.strptime(cleaned, pattern)
            if parsed.tzinfo is None:
                return timezone.make_aware(parsed, timezone.get_current_timezone())
            return parsed.astimezone(dt_timezone.utc)
        except ValueError:
            continue
    try:
        parsed = datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed.astimezone(dt_timezone.utc)
    except ValueError:
        return None


def _canonicalize_url(url):
    return (url or "").strip()


def _build_external_id(url, source_name, title):
    canonical = _canonicalize_url(url) or f"{source_name}:{title}"
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:32]


def _match_game_from_title(title):
    if not title:
        return None
    text = title.lower()
    candidates = list(Game.objects.order_by("-popularity", "name"))
    results = []
    for game in candidates:
        name = game.name.lower()
        if name in text:
            results.append((len(name), game))
        elif all(part.lower() in text for part in name.split() if len(part) > 3):
            results.append((len(name), game))
    if not results:
        return None
    return max(results, key=lambda item: item[0])[1]


def _extract_media_fields(node):
    image_url = ""
    video_url = ""
    for candidate in ["enclosure", "media:thumbnail", "thumbnail", "media:content", "content"]:
        item = _find_child(node, candidate)
        if item is None:
            continue
        attrs = item.attrib
        if attrs.get("url"):
            url_value = attrs.get("url")
            if "video" in attrs.get("type", "").lower() or "youtube" in url_value.lower():
                video_url = url_value
            else:
                image_url = url_value
            continue
    if not image_url:
        for tag in ["{http://search.yahoo.com/mrss/}thumbnail", "{http://search.yahoo.com/mrss/}content"]:
            candidates = node.findall(f"./{tag}")
            for item in candidates:
                url_value = item.attrib.get("url", "")
                if url_value:
                    if "video" in item.attrib.get("type", "").lower():
                        video_url = url_value
                    else:
                        image_url = url_value
    return image_url, video_url


def _normalize_item(source_name, source_url, item_node, fallback_url=""):
    title = _find_text(item_node, "title")
    link = _find_attr(item_node, "href", "link") or _find_attr(item_node, "url", "link") or _find_text(item_node, "link") or fallback_url
    description = _find_text(item_node, "description", "summary", "content", "content:encoded")
    if not description:
        description = title
    published_value = _find_text(item_node, "pubDate", "published", "updated")
    published_at = _parse_published_date(published_value)
    image_url, video_url = _extract_media_fields(item_node)
    if not image_url and "youtube" in (link or "").lower() and video_url:
        image_url = video_url
    game = _match_game_from_title(title)
    external_id = _build_external_id(link or f"{source_name}:{title}", source_name, title)
    return {
        "source_name": source_name,
        "source_url": source_url,
        "title": title or "Gaming update",
        "excerpt": description[:280] if description else "Public gaming update.",
        "url": link or "https://ggz.app",
        "image_url": image_url,
        "video_url": video_url,
        "published_at": published_at or timezone.now(),
        "game": game,
        "external_id": external_id,
    }


def _parse_rss_feed(source_name, source_url, xml_text):
    root = ET.fromstring(xml_text)
    if root.tag.endswith("rss"):
        channel = root.find("channel")
        if channel is None:
            return []
        return [_normalize_item(source_name, source_url, item, source_url) for item in channel.findall("item") if _find_text(item, "title")]

    entries = root.findall(".//{*}entry")
    if entries:
        items = []
        for entry in entries:
            title = _find_text(entry, "title")
            if title:
                items.append(_normalize_item(source_name, source_url, entry, source_url))
        return items

    return []


def fetch_public_feed(source):
    try:
        request = Request(source["url"], headers={"User-Agent": "GGz Gaming Discovery/1.0"})
        with urlopen(request, timeout=20) as response:
            payload = response.read()
            return _parse_rss_feed(source["name"], source["url"], payload.decode("utf-8", errors="replace"))
    except Exception:
        return []


def refresh_public_gaming_feed(game_ids=None):
    game_queryset = Game.objects.filter(id__in=game_ids) if game_ids else Game.objects.all()
    source_items = []
    for source in PUBLIC_GAMING_SOURCES:
        for item in fetch_public_feed(source):
            source_items.append(item)
    created = 0
    for item in source_items:
        game = item["game"]
        if game_ids and game and game.id not in game_ids:
            continue
        if not game and (game_ids or True):
            if item["title"]:
                game = _match_game_from_title(item["title"])
        defaults = {
            "source_name": item["source_name"],
            "source_url": item["source_url"],
            "title": item["title"],
            "excerpt": item["excerpt"],
            "url": item["url"],
            "image_url": item["image_url"],
            "video_url": item["video_url"],
            "published_at": item["published_at"],
            "content_type": "NEWS",
            "game": game,
            "is_active": True,
        }
        obj, is_created = ExternalFeedItem.objects.update_or_create(
            external_id=item["external_id"],
            defaults=defaults,
        )
        if is_created:
            created += 1
    return created
