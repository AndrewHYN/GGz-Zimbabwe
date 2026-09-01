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
	steam_url = models.URLField(blank=True)
	epic_url = models.URLField(blank=True)
	trailer_url = models.URLField(blank=True)

	def __str__(self):
		return self.name

	@property
	def display_price(self):
		return "Free to Play" if self.free_to_play else "Buy"

	@property
	def primary_store_url(self):
		for candidate in (self.steam_url, self.epic_url, self.store_url):
			if candidate:
				return candidate
		return ""

	@property
	def acquisition_links(self):
		links = []
		store_urls = [
			("steam", self.steam_url or (self.store_url if (self.store_url and "steampowered.com" in (urlparse(self.store_url).netloc or "").lower()) else "")),
			("epic", self.epic_url or (self.store_url if (self.store_url and "epicgames.com" in (urlparse(self.store_url).netloc or "").lower()) else "")),
		]
		for _, url in store_urls:
			if url:
				if "steampowered.com" in (urlparse(url).netloc or "").lower():
					links.append({"label": "Buy on Steam", "url": url, "aria_label": "BUY ON STEAM"})
				elif "epicgames.com" in (urlparse(url).netloc or "").lower():
					links.append({"label": "Buy on Epic", "url": url, "aria_label": "BUY ON EPIC"})
		if self.free_to_play and not links:
			url = self.primary_store_url or self.store_url
			if url:
				links.append({"label": "Play Free", "url": url, "aria_label": "PLAY FREE"})
		if not self.free_to_play and not links and self.primary_store_url:
			links.append({"label": "Get Game", "url": self.primary_store_url, "aria_label": "GET GAME"})
		return links

	@property
	def buy_label(self):
		if self.free_to_play:
			return "Play Free"
		if self.steam_url:
			return "Buy on Steam"
		if self.epic_url:
			return "Buy on Epic"
		return "Get Game"

	@property
	def trailer_embed_url(self):
		if not self.trailer_url:
			return ""
		parsed = urlparse(self.trailer_url)
		host = (parsed.netloc or "").lower()
		if host in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
			video_id = parse_qs(parsed.query).get("v", [None])[0]
			if not video_id and parsed.path:
				path_parts = [part for part in parsed.path.split("/") if part]
				if len(path_parts) >= 2 and path_parts[0] == "shorts":
					video_id = path_parts[1]
				elif len(path_parts) >= 1 and path_parts[0] != "embed":
					video_id = path_parts[-1]
			if video_id:
				return f"https://www.youtube.com/embed/{video_id}"
		if "youtu.be" in host:
			video_id = parsed.path.strip("/").split("/")[-1]
			if video_id:
				return f"https://www.youtube.com/embed/{video_id}"
		return ""

	@property
	def store_label(self):
		if self.free_to_play:
			return "Play Free"
		if self.steam_url:
			return "Buy on Steam"
		if self.epic_url:
			return "Buy on Epic"
		if self.primary_store_url:
			host = (urlparse(self.primary_store_url).netloc or "").lower()
			if "steampowered.com" in host:
				return "Buy on Steam"
			if "epicgames.com" in host:
				return "Buy on Epic"
			if "gog.com" in host:
				return "Get on GOG"
			if "xbox.com" in host or "microsoft.com" in host:
				return "Get on Xbox"
			if "playstation.com" in host:
				return "Get on PlayStation"
			if "itch.io" in host:
				return "Get on itch.io"
		return "Get Game"
