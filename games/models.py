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

	def __str__(self):
		return self.name
