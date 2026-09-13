from django.core.management.base import BaseCommand

from games.models import Game
from games.services.igdb import IGDBError, is_configured, sync_game


class Command(BaseCommand):
    help = "Refresh IGDB catalogue metadata for local games."

    def add_arguments(self, parser):
        parser.add_argument("--game-id", type=int, help="Sync only this Game id.")
        parser.add_argument(
            "--all",
            action="store_true",
            help="Also try to match games that do not have an IGDB id yet.",
        )

    def handle(self, *args, **options):
        if not is_configured():
            self.stderr.write("IGDB is not configured (IGDB_CLIENT_ID / IGDB_CLIENT_SECRET).")
            return

        queryset = Game.objects.all()
        if options["game_id"]:
            queryset = queryset.filter(id=options["game_id"])
        elif not options["all"]:
            queryset = queryset.filter(igdb_id__isnull=False)

        synced = 0
        for game in queryset.order_by("name"):
            try:
                updated = sync_game(game)
            except IGDBError as exc:
                self.stderr.write(f"Skipped {game.name}: {exc}")
                continue
            if updated:
                synced += 1
                self.stdout.write(f"  OK  {game.name}")
            else:
                self.stdout.write(f"  ... {game.name}")

        self.stdout.write(self.style.SUCCESS(f"Synced {synced} of {queryset.count()} games."))