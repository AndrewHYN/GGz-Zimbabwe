"""
Media Recovery Command

Scans local media files and attempts to match them to database records
that have empty media fields. Uses local filesystem scan to avoid
S3 HeadObject calls that trigger 403 on Supabase.
"""

import re
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings

from games.models import Game
from accounts.models import GamerProfile, Post
from tournaments.models import Tournament
from events.models import Event, Organization
from teams.models import Team


class Command(BaseCommand):
    help = "Scan local media files and recover missing media references"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be changed without making changes",
        )
        parser.add_argument(
            "--content-type",
            choices=[
                "all", "games", "profiles", "tournaments",
                "events", "organizations", "teams", "posts",
            ],
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

    def _get_local_files(self, subdir):
        """List files under MEDIA_ROOT/subdir using local filesystem.

        Returns list of relative paths as strings (e.g. 'tournaments/banner.jpg').
        Avoids default_storage.listdir() which triggers HeadObject on S3.
        """
        target = Path(settings.MEDIA_ROOT) / subdir
        if not target.is_dir():
            self.stdout.write(self.style.WARNING(f"  Directory does not exist: {target}"))
            return []
        return [
            f"{subdir}/{p.relative_to(target).as_posix()}"
            for p in target.rglob("*")
            if p.is_file()
        ]

    def _match_filename(self, needle, filenames):
        """Fuzzy-match a search string against a list of filename strings.

        Returns the best-matching filename string, or None.
        Scoring: exact substring = 10, word-fragment (>3 chars) = 2.
        Threshold: 5.
        """
        if not needle:
            return None
        needle_lower = needle.lower().strip()
        words = [w for w in needle_lower.split() if len(w) > 3]
        best_match = None
        best_score = 0

        for fname in filenames:
            fname_lower = fname.lower()
            score = 0
            if needle_lower in fname_lower:
                score += 10
            for word in words:
                if word in fname_lower:
                    score += 2
            if score > best_score:
                best_score = score
                best_match = fname

        return best_match if best_score >= 5 else None

    def _recover_game_covers(self, dry_run, force, stats):
        """Recover game cover art via IGDB sync."""
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
                    action = "Would sync" if dry_run else "Synced"
                    self.stdout.write(f"  {action} cover for {game.name}: {updated.cover_art_url}")
                else:
                    stats["skipped"] += 1
            except Exception:
                stats["skipped"] += 1

    def _recover_profile_covers(self, dry_run, force, stats):
        """Recover profile cover/avatar images from media/covers/."""
        self.stdout.write("Checking profile covers...")
        profiles = GamerProfile.objects.all()
        stats["checked"] = profiles.count()

        cover_files = self._get_local_files("covers")
        for profile in profiles:
            if profile.cover and not force:
                stats["skipped"] += 1
                continue
            match = self._match_filename(profile.gamer_tag, cover_files)
            if match:
                if not dry_run:
                    profile.cover.name = match
                    profile.save(update_fields=["cover"])
                stats["updated"] += 1
                self.stdout.write(f"  Updated cover for {profile.gamer_tag}: {match}")
            else:
                stats["skipped"] += 1

    def _recover_tournament_banners(self, dry_run, force, stats):
        """Recover tournament banners from media/tournaments/."""
        self.stdout.write("Checking tournament banners...")
        tournaments = Tournament.objects.all()
        stats["checked"] = tournaments.count()

        banner_files = self._get_local_files("tournaments")
        for tournament in tournaments:
            if tournament.banner and not force:
                stats["skipped"] += 1
                continue
            match = self._match_filename(tournament.name, banner_files)
            if not match:
                match = self._match_filename(tournament.slug, banner_files)
            if match:
                if not dry_run:
                    tournament.banner.name = match
                    tournament.save(update_fields=["banner"])
                stats["updated"] += 1
                self.stdout.write(f"  Updated banner for {tournament.name}: {match}")
            else:
                stats["skipped"] += 1

    def _recover_event_banners(self, dry_run, force, stats):
        """Recover event banners from media/events/."""
        self.stdout.write("Checking event banners...")
        events = Event.objects.all()
        stats["checked"] = events.count()

        event_files = self._get_local_files("events")
        for event in events:
            if event.banner and not force:
                stats["skipped"] += 1
                continue
            match = self._match_filename(event.name, event_files)
            if match:
                if not dry_run:
                    event.banner.name = match
                    event.save(update_fields=["banner"])
                stats["updated"] += 1
                self.stdout.write(f"  Updated banner for {event.name}: {match}")
            else:
                stats["skipped"] += 1

    def _recover_organization_logos(self, dry_run, force, stats):
        """Recover organization logos from media/organizations/."""
        self.stdout.write("Checking organization logos...")
        orgs = Organization.objects.all()
        stats["checked"] = orgs.count()

        logo_files = self._get_local_files("organizations")
        for org in orgs:
            if org.logo and not force:
                stats["skipped"] += 1
                continue
            match = self._match_filename(org.name, logo_files)
            if not match:
                match = self._match_filename(org.slug, logo_files)
            if match:
                if not dry_run:
                    org.logo.name = match
                    org.save(update_fields=["logo"])
                stats["updated"] += 1
                self.stdout.write(f"  Updated logo for {org.name}: {match}")
            else:
                stats["skipped"] += 1

    def _recover_team_media(self, dry_run, force, stats):
        """Recover team logos and banners from media/teams/."""
        self.stdout.write("Checking team media...")
        teams = Team.objects.all()
        stats["checked"] = teams.count()

        logo_files = self._get_local_files("teams")
        banner_files = self._get_local_files("teams")

        for team in teams:
            if not (team.logo and not force):
                match = self._match_filename(team.name, logo_files)
                if not match:
                    match = self._match_filename(team.slug, logo_files)
                if match:
                    if not dry_run:
                        team.logo.name = match
                        team.save(update_fields=["logo"])
                    stats["updated"] += 1
                    self.stdout.write(f"  Updated logo for {team.name}: {match}")
                else:
                    stats["skipped"] += 1
            else:
                stats["skipped"] += 1

            if not (team.banner and not force):
                match = self._match_filename(team.name, banner_files)
                if not match:
                    match = self._match_filename(team.slug, banner_files)
                if match:
                    if not dry_run:
                        team.banner.name = match
                        team.save(update_fields=["banner"])
                    stats["updated"] += 1
                    self.stdout.write(f"  Updated banner for {team.name}: {match}")
                else:
                    stats["skipped"] += 1
            else:
                stats["skipped"] += 1

    def _recover_post_images(self, dry_run, force, stats):
        """Recover post images from media/posts/."""
        self.stdout.write("Checking post images...")
        posts = Post.objects.all()
        stats["checked"] = posts.count()

        post_files = self._get_local_files("posts")
        for post in posts:
            if post.image and not force:
                stats["skipped"] += 1
                continue
            search_key = str(post.id)
            if hasattr(post, "author") and post.author:
                search_key = post.author.gamer_tag
            match = self._match_filename(search_key, post_files)
            if match:
                if not dry_run:
                    post.image.name = match
                    post.save(update_fields=["image"])
                stats["updated"] += 1
                self.stdout.write(f"  Updated image for post {post.id}: {match}")
            else:
                stats["skipped"] += 1

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
