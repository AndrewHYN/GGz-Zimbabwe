"""Canonical GGz social relationship resolver and state machine.

Single authority for the GGz social graph:

    Following someone keeps you updated. When two players follow each other
    they are Friends. Friends get friend-level features; squads and played
    together remain separate gaming relationships. Block overrides everything.

`Follow` mutuality is the source of truth for friendship. `Friendship` rows are
a synchronized compatibility layer (materialized mirror) so existing friends
lists, counts, and priority ordering keep working; every write to the mirror is
coordinated here, never from views.

Direct `Friendship.objects` writes outside this module are unsupported.
"""

import time

from django.db import transaction
from django.db.models import Q

from .models import Block, Follow, FriendRequest, Friendship, MessageRequest, notify


def _ordered_pair_ids(first, second):
    return sorted((first.id, second.id))


def _mirror_for_pair(first, second):
    first_id, second_id = _ordered_pair_ids(first, second)
    return Friendship.objects.filter(profile_one_id=first_id, profile_two_id=second_id).first()


def is_blocked_between(first, second):
    if first is None or second is None or first.id == second.id:
        return False
    return Block.objects.filter(
        Q(blocker=first, blocked=second) | Q(blocker=second, blocked=first)
    ).exists()


def is_friend(first, second):
    if first is None or second is None or first.id == second.id or is_blocked_between(first, second):
        return False
    first_id, second_id = _ordered_pair_ids(first, second)
    if Friendship.objects.filter(profile_one_id=first_id, profile_two_id=second_id).exists():
        return True
    return (
        Follow.objects.filter(follower=first, following=second).exists()
        and Follow.objects.filter(follower=second, following=first).exists()
    )


def relationship_between(viewer, target):
    """Answer the canonical relationship state between two players.

    States: NONE, FOLLOWING, FOLLOWED_BY, FRIENDS, BLOCKED_BY_ME, BLOCKED_BY_THEM.
    """
    if viewer is None or target is None or viewer.id == target.id:
        return "NONE"
    if Block.objects.filter(blocker=viewer, blocked=target).exists():
        return "BLOCKED_BY_ME"
    if Block.objects.filter(blocker=target, blocked=viewer).exists():
        return "BLOCKED_BY_THEM"
    if is_friend(viewer, target):
        return "FRIENDS"
    if Follow.objects.filter(follower=viewer, following=target).exists():
        return "FOLLOWING"
    if Follow.objects.filter(follower=target, following=viewer).exists():
        return "FOLLOWED_BY"
    return "NONE"


def _notify_friends(recipient, follower, target_url):
    """Single combined event when follow-back completes a friendship."""
    first_id, second_id = _ordered_pair_ids(recipient, follower)
    event_key = f"friends:{first_id}:{second_id}:{time.time_ns()}"
    notify(
        recipient,
        follower,
        "friends",
        f"{follower.gamer_tag} followed you back \u2014 you're now Friends",
        target_url,
        event_key=event_key,
    )


def _ensure_mirror_for_pair(first, second):
    """Create the friendship mirror when mutual follows exist; drop it when they do not.

    The mirror is materialized data only; mutuality is the source of truth.
    Returns (created_mirror, removed_mirror).
    """
    first_id, second_id = _ordered_pair_ids(first, second)
    mutual = (
        Follow.objects.filter(follower=first, following=second).exists()
        and Follow.objects.filter(follower=second, following=first).exists()
    )
    created = removed = False
    if mutual:
        _, created = Friendship.objects.get_or_create(profile_one_id=first_id, profile_two_id=second_id)
    else:
        removed = bool(Friendship.objects.filter(profile_one_id=first_id, profile_two_id=second_id).delete()[0])
    return created, removed


def follow(viewer, target):
    """Create a one-way follow. Returns (created, became_friends)."""
    if viewer is None or target is None or viewer.id == target.id:
        return (False, False)
    if is_blocked_between(viewer, target):
        return (False, False)
    _, created = Follow.objects.get_or_create(follower=viewer, following=target)
    if not created:
        return (False, is_friend(viewer, target))
    became_friends = False
    if Follow.objects.filter(follower=target, following=viewer).exists():
        mirror_created, _ = _ensure_mirror_for_pair(viewer, target)
        became_friends = mirror_created
        if became_friends:
            _notify_friends(recipient=target, follower=viewer, target_url=f"/profiles/{viewer.gamer_tag}/")
    else:
        notify(target, viewer, "follow", f"{viewer.gamer_tag} followed you", f"/profiles/{viewer.gamer_tag}/")
    return (True, became_friends)


def unfollow(viewer, target):
    """Remove a one-way follow. Returns (deleted, broke_friendship)."""
    if viewer is None or target is None or viewer.id == target.id:
        return (False, False)
    deleted = bool(Follow.objects.filter(follower=viewer, following=target).delete()[0])
    _, removed = _ensure_mirror_for_pair(viewer, target)
    return (deleted, removed)


def remove_friend(first, second):
    """Unfriend: remove both directions of follow and any friendship mirror."""
    if first is None or second is None or first.id == second.id:
        return False
    Follow.objects.filter(
        Q(follower=first, following=second) | Q(follower=second, following=first)
    ).delete()
    first_id, second_id = _ordered_pair_ids(first, second)
    return bool(Friendship.objects.filter(profile_one_id=first_id, profile_two_id=second_id).delete()[0])


def block_user(viewer, target):
    """Block overrides every relationship state.

    Removes follows both ways, the friendship mirror, pending friend requests,
    and pending message requests. Conversations are not destroyed but their
    access is already blocked at every messaging boundary.
    """
    if viewer is None or target is None or viewer.id == target.id:
        return False
    with transaction.atomic():
        Block.objects.get_or_create(blocker=viewer, blocked=target)
        Follow.objects.filter(
            Q(follower=viewer, following=target) | Q(follower=target, following=viewer)
        ).delete()
        FriendRequest.objects.filter(
            Q(sender=viewer, receiver=target) | Q(sender=target, receiver=viewer)
        ).delete()
        MessageRequest.objects.filter(
            Q(sender=viewer, recipient=target) | Q(sender=target, recipient=viewer)
        ).delete()
        first_id, second_id = _ordered_pair_ids(viewer, target)
        Friendship.objects.filter(profile_one_id=first_id, profile_two_id=second_id).delete()
    return True


def can_message(sender, recipient):
    """Friends (mutual follows) or an accepted message request may message.

    A one-way follow alone does NOT grant direct messaging.
    """
    if sender is None or recipient is None or sender.id == recipient.id:
        return False
    if is_blocked_between(sender, recipient):
        return False
    if is_friend(sender, recipient):
        return True
    return MessageRequest.objects.filter(
        Q(sender=sender, recipient=recipient) | Q(sender=recipient, recipient=sender),
        status="Accepted",
    ).exists()