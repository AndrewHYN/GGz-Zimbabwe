from django.db import migrations
from django.db.models import Q


def normalize_friendships(migration_apps, schema_editor):
    """Align the social graph with the M11 rule without destroying data.

    Friendships were previously created through explicit friend requests and
    could exist without reciprocal follows. In M11 mutual Follows are the
    source of truth and Friendship is a synchronized compatibility layer:

      * Every existing Friendship pair gains the missing reciprocal Follow
        (unless the pair blocks each other, in which case the stale
        Friendship mirror row is removed -- block always wins).
      * Every pair that already follows each other gains a Friendship mirror
        row so lists, counts, and messaging stay consistent.

    Conversations, messages, notifications, and blocks are left untouched.
    """
    Follow = migration_apps.get_model("accounts", "Follow")
    Friendship = migration_apps.get_model("accounts", "Friendship")
    Block = migration_apps.get_model("accounts", "Block")

    for friendship in Friendship.objects.select_related("profile_one", "profile_two").iterator():
        first = friendship.profile_one
        second = friendship.profile_two
        if first.id == second.id:
            friendship.delete()
            continue
        blocked = Block.objects.filter(
            Q(blocker=first, blocked=second) | Q(blocker=second, blocked=first)
        ).exists()
        if blocked:
            friendship.delete()
            continue
        Follow.objects.get_or_create(follower=first, following=second)
        Follow.objects.get_or_create(follower=second, following=first)

    seen = set()
    for follow in Follow.objects.select_related("follower", "following").iterator():
        first_id, second_id = sorted((follow.follower_id, follow.following_id))
        pair_key = (first_id, second_id)
        if pair_key in seen or first_id == second_id:
            continue
        seen.add(pair_key)
        if not Follow.objects.filter(follower_id=second_id, following_id=first_id).exists():
            continue
        Friendship.objects.get_or_create(profile_one_id=first_id, profile_two_id=second_id)


def noop(migration_apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0024_socialidentity_metadata_and_more"),
    ]

    operations = [
        migrations.RunPython(normalize_friendships, noop),
    ]