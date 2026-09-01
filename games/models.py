from urllib.parse import parse_qs, urlparse

from django.db import models


class Game(models.Model):
	name = models.CharField(max_length=100, unique=True)
	cover_art_url = models.URLField(blank=True)
	description = models.TextField(blank=True)
	genre = models.CharField(max_length=100, blank=True)
	developer = models.CharField(max_length=100, blank=True)
	publisher = models.CharField(max_length=100, blank=True)
	platform = models.CharField(max_length=100, blank=True)
	player_count = models.PositiveIntegerField(blank=True, null=True)
	popularity = models.PositiveIntegerField(default=0)
	release_year = models.PositiveIntegerField(blank=True, null=True)
	free_to_play = models.BooleanField(default=False)
	featured = models.BooleanField(default=False)
	sponsored = models.BooleanField(default=False)
	local_developer = models.BooleanField(default=False)
	store_url = models.URLField(blank=True)
	trailer_url = models.URLField(blank=True)

	def __str__(self):
		return self.name

	@property
	def display_price(self):
		return "Free to Play" if self.free_to_play else "Buy"

	@property
	def buy_label(self):
		return "Play Free" if self.free_to_play else "Buy on Steam"

	@property
	def trailer_embed_url(self):
		if not self.trailer_url:
			return ""
		parsed = urlparse(self.trailer_url)
		host = (parsed.netloc or "").lower()
		if "youtube.com" in host or "www.youtube.com" in host:
			video_id = parse_qs(parsed.query).get("v", [None])[0]
			if not video_id:
				match = parsed.path.rstrip("/").split("/")
				video_id = match[-1] if len(match) and match[-1] else ""
			if video_id:
				return f"https://www.youtube.com/embed/{video_id}"
		if "youtu.be" in host:
			video_id = parsed.path.strip("/")
			if video_id:
				return f"https://www.youtube.com/embed/{video_id}"
		return ""

	@property
	def store_label(self):
		if not self.store_url:
			return "Get Game"
		if self.free_to_play:
			return "Play Free"
		host = (urlparse(self.store_url).netloc or "").lower()
		if "steampowered.com" in host:
			return "Buy on Steam"
		if "epicgames.com" in host:
			return "Get on Epic Games"
		if "gog.com" in host:
			return "Get on GOG"
		if "xbox.com" in host or "microsoft.com" in host:
			return "Get on Xbox"
		if "playstation.com" in host:
			return "Get on PlayStation"
		if "itch.io" in host:
			return "Get on itch.io"
		return "Get Game"
