from django.core.management.base import BaseCommand

from accounts.services import refresh_public_gaming_feed
from games.models import Game


class Command(BaseCommand):
    help = "Refresh cached public gaming discovery items from configured sources."

    def add_arguments(self, parser):
        parser.add_argument("--game", type=int, dest="game_id", help="Optional game ID to refresh for a single title.")

    def handle(self, *args, **options):
        game_id = options.get("game_id")
        if game_id:
            game = Game.objects.filter(id=game_id).first()
            if not game:
                self.stdout.write(self.style.ERROR(f"No game found for ID {game_id}."))
                return
            created = refresh_public_gaming_feed(game_ids=[game.id])
            self.stdout.write(self.style.SUCCESS(f"Refreshed public gaming feed for {game.name}: {created} items added."))
            return

        created = refresh_public_gaming_feed()
        self.stdout.write(self.style.SUCCESS(f"Refreshed public gaming feed: {created} items added."))
