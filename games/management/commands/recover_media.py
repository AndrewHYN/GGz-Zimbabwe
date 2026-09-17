"""
Media Recovery Command

Scans existing storage files and attempts to match them to database records
that have empty media fields. Supports dry-run mode for safe testing.
"""

import os
import re
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.conf import settings

from games.models import Game
from accounts.models import GamerProfile, Post
from tournaments.models import Tournament
from events.models import Event, Organization
from teams.models import Team
from marketplace.models import ListingImage


class Command(BaseCommand):
    help = "Scan storage and recover missing media references"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be changed without making changes",
        )
        parser.add_argument(
            "--content-type",
            choices=["all", "games", "profiles", "tournaments", "events", "organizations", "teams", "posts"],
            default="all",
            help="Content type to recover",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Overwrite existing media fields (default: only fill empty)",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        content_type = options["content_type"]
        force = options["force"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN MODE - No changes will be made"))

        media_root = Path(settings.MEDIA_ROOT)
        results = {
            "games": {"checked": 0, "updated": 0, "skipped": 0},
            "profiles": {"checked": 0, "updated": 0, "skipped": 0},
            "tournaments": {"checked": 0, "updated": 0, "skipped": 0},
            "events": {"checked": 0, "updated": 0, "skipped": 0},
            "organizations": {"checked": 0, "updated": 0, "skipped": 0},
            "teams": {"checked": 0, "updated": 0, "skipped": 0},
            "posts": {"checked": 0, "updated": 0, "skipped": 0},
        }

        if content_type in ("all", "games"):
            self._recover_game_covers(dry_run, force, results["games"])

        if content_type in ("all", "profiles"):
            self._recover_profile_covers(dry_run, force, results["profiles"])

        if content_type in ("all", "tournaments"):
            self._recover_tournament_banners(dry_run, force, results["tournaments"])

        if content_type in ("all", "events"):
            self._recover_event_banners(dry_run, force, results["events"])

        if content_type in ("all", "organizations"):
            self._recover_organization_logos(dry_run, force, results["organizations"])

        if content_type in ("all", "teams"):
            self._recover_team_media(dry_run, force, results["teams"])

        if content_type in ("all", "posts"):
            self._recover_post_images(dry_run, force, results["posts"])

        self._print_summary(results, dry_run)

    def _get_media_files(self, subdir):
        """Get all files in a media subdirectory using the configured storage backend."""
        from django.core.files.storage import default_storage
        try:
            # List files in the subdirectory using the storage backend
            dirs, files = default_storage.listdir(subdir)
            return [f"{subdir}/{f}" for f in files]
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"  Could not list {subdir}: {e}"))
            return []

    def _match_file_to_record(self, filename, candidates, key_fields):
        """Try to match a filename to a record using fuzzy matching."""
        # Handle both Path objects and strings
        if hasattr(filename, 'name'):
            filename_lower = filename.name.lower()
        else:
            filename_lower = filename.lower()
        best_match = None
        best_score = 0

        for record in candidates:
            score = 0
            for field in key_fields:
                value = getattr(record, field, "")
                if value:
                    value_lower = str(value).lower()
                    # Exact name match
                    if value_lower in filename_lower:
                        score += 10
                    # Partial word match
                    for word in value_lower.split():
                        if len(word) > 3 and word in filename_lower:
                            score += 2

            if score > best_score:
                best_score = score
                best_match = record

        return best_match if best_score >= 5 else None

    def _recover_game_covers(self, dry_run, force, stats):
        """Recover game cover art from IGDB sync."""
        from games.services.igdb import sync_game
        self.stdout.write("Checking game covers...")
        games = Game.objects.all()
        stats["checked"] = games.count()

        for game in games:
            if game.cover_art_url and not force:
                stats["skipped"] += 1
                continue

            try:
                updated = sync_game(game)
                if updated:
                    stats["updated"] += 1
                    if not dry_run:
                        self.stdout.write(f"  Synced cover for {game.name}: {updated.cover_art_url}")
                    else:
                        self.stdout.write(f"  Would sync cover for {game.name}: {updated.cover_art_url}")
                else:
                    stats["skipped"] += 1
            except Exception:
                stats["skipped"] += 1

        self.stdout.write(f"  Games checked: {stats['checked']}, updated: {stats['updated']}, skipped: {stats['skipped']}")

    def _recover_profile_covers(self, dry_run, force, stats):
        """Recover profile cover images."""
        self.stdout.write("Checking profile covers...")
        profiles = GamerProfile.objects.all()
        stats["checked"] = profiles.count()

        cover_files = self._get_media_files("covers")
        if not cover_files:
            self.stdout.write("  No cover files found in media/covers/")
            stats["skipped"] = stats["checked"]
            return

        for profile in profiles:
            if profile.cover and not force:
                stats["skipped"] += 1
                continue

            # Try to match by gamer_tag
            match = self._match_file_to_record(
                "",
                cover_files,
                ["gamer_tag"]
            )
            if match:
                if not dry_run:
                    profile.cover.name = match
                    profile.save(update_fields=["cover"])
                stats["updated"] += 1
                self.stdout.write(f"  Updated cover for {profile.gamer_tag}: {match}")
            else:
                stats["skipped"] += 1

        self.stdout.write(f"  Profiles checked: {stats['checked']}, updated: {stats['updated']}, skipped: {stats['skipped']}")

    def _recover_tournament_banners(self, dry_run, force, stats):
        """Recover tournament banners."""
        self.stdout.write("Checking tournament banners...")
        tournaments = Tournament.objects.all()
        stats["checked"] = tournaments.count()

        banner_files = self._get_media_files("tournaments")
        if not banner_files:
            self.stdout.write("  No banner files found in media/tournaments/")
            stats["skipped"] = stats["checked"]
            return

        for tournament in tournaments:
            if tournament.banner and not force:
                stats["skipped"] += 1
                continue

            match = self._match_file_to_record(
                tournament.name,
                banner_files,
                ["name", "slug"]
            )
            if match:
                if not dry_run:
                    tournament.banner.name = match
                    tournament.save(update_fields=["banner"])
                stats["updated"] += 1
                self.stdout.write(f"  Updated banner for {tournament.name}: {match}")
            else:
                stats["skipped"] += 1

        self.stdout.write(f"  Tournaments checked: {stats['checked']}, updated: {stats['updated']}, skipped: {stats['skipped']}")

    def _recover_event_banners(self, dry_run, force, stats):
        """Recover event banners."""
        self.stdout.write("Checking event banners...")
        events = Event.objects.all()
        stats["checked"] = events.count()

        # Check if there are event banner files
        event_files = self._get_media_files("events")
        if not event_files:
            self.stdout.write("  No banner files found in media/events/")
            stats["skipped"] = stats["checked"]
            return

        for event in events:
            if event.banner and not force:
                stats["skipped"] += 1
                continue

            match = self._match_file_to_record(
                event.name,
                event_files,
                ["name", "slug"]
            )
            if match:
                rel_path = match.relative_to(settings.MEDIA_ROOT)
                if not dry_run:
                    event.banner.name = str(rel_path)
                    event.save(update_fields=["banner"])
                stats["updated"] += 1
                self.stdout.write(f"  Updated banner for {event.name}: {rel_path}")
            else:
                stats["skipped"] += 1

        self.stdout.write(f"  Events checked: {stats['checked']}, updated: {stats['updated']}, skipped: {stats['skipped']}")

    def _recover_organization_logos(self, dry_run, force, stats):
        """Recover organization logos."""
        self.stdout.write("Checking organization logos...")
        orgs = Organization.objects.all()
        stats["checked"] = orgs.count()

        logo_files = self._get_media_files("organizations/logos")
        if not logo_files:
            self.stdout.write("  No logo files found in media/organizations/logos/")
            stats["skipped"] = stats["checked"]
            return

        for org in orgs:
            if org.logo and not force:
                stats["skipped"] += 1
                continue

            match = self._match_file_to_record(
                org.name,
                logo_files,
                ["name", "slug"]
            )
            if match:
                if not dry_run:
                    org.logo.name = match
                    org.save(update_fields=["logo"])
                stats["updated"] += 1
                self.stdout.write(f"  Updated logo for {org.name}: {match}")
            else:
                stats["skipped"] += 1

        self.stdout.write(f"  Organizations checked: {stats['checked']}, updated: {stats['updated']}, skipped: {stats['skipped']}")

    def _recover_team_media(self, dry_run, force, stats):
        """Recover team logos and banners."""
        self.stdout.write("Checking team media...")
        teams = Team.objects.all()
        stats["checked"] = teams.count()

        logo_files = self._get_media_files("teams/logos")
        banner_files = self._get_media_files("teams/banners")

        for team in teams:
            if team.logo and not force:
                stats["skipped"] += 1
            else:
                match = self._match_file_to_record(team.name, logo_files, ["name", "slug"])
                if match:
                    if not dry_run:
                        team.logo.name = match
                        team.save(update_fields=["logo"])
                    stats["updated"] += 1
                    self.stdout.write(f"  Updated logo for {team.name}: {match}")
                else:
                    stats["skipped"] += 1

            if team.banner and not force:
                stats["skipped"] += 1
            else:
                match = self._match_file_to_record(team.name, banner_files, ["name", "slug"])
                if match:
                    if not dry_run:
                        team.banner.name = match
                        team.save(update_fields=["banner"])
                    stats["updated"] += 1
                    self.stdout.write(f"  Updated banner for {team.name}: {match}")
                else:
                    stats["skipped"] += 1

        self.stdout.write(f"  Teams checked: {stats['checked']}, updated: {stats['updated']}, skipped: {stats['skipped']}")

    def _recover_post_images(self, dry_run, force, stats):
        """Recover post images."""
        self.stdout.write("Checking post images...")
        posts = Post.objects.all()
        stats["checked"] = posts.count()

        post_files = self._get_media_files("posts")
        if not post_files:
            self.stdout.write("  No image files found in media/posts/")
            stats["skipped"] = stats["checked"]
            return

        for post in posts:
            if post.image and not force:
                stats["skipped"] += 1
                continue

            # Match by post ID or author
            match = self._match_file_to_record(
                str(post.id),
                post_files,
                ["id", "author__gamer_tag"]
            )
            if match:
                if not dry_run:
                    post.image.name = match
                    post.save(update_fields=["image"])
                stats["updated"] += 1
                self.stdout.write(f"  Updated image for post {post.id}: {match}")
            else:
                stats["skipped"] += 1

        self.stdout.write(f"  Posts checked: {stats['checked']}, updated: {stats['updated']}, skipped: {stats['skipped']}")

    def _print_summary(self, results, dry_run):
        self.stdout.write("\n" + "=" * 50)
        self.stdout.write(self.style.NOTICE("RECOVERY SUMMARY"))
        self.stdout.write("=" * 50)

        total_checked = sum(r["checked"] for r in results.values())
        total_updated = sum(r["updated"] for r in results.values())
        total_skipped = sum(r["skipped"] for r in results.values())

        for category, stats in results.items():
            self.stdout.write(
                f"  {category.capitalize():12s}: checked={stats['checked']:3d} "
                f"updated={stats['updated']:3d} skipped={stats['skipped']:3d}"
            )

        self.stdout.write("-" * 50)
        self.stdout.write(
            f"  {'TOTAL':12s}: checked={total_checked:3d} "
            f"updated={total_updated:3d} skipped={total_skipped:3d}"
        )

        if dry_run:
            self.stdout.write(self.style.WARNING("\nDRY RUN - No changes were made. Run without --dry-run to apply."))
        else:
            self.stdout.write(self.style.SUCCESS("\nRecovery complete."))