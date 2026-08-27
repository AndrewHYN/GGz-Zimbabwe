from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import F, Q
from django.http import HttpResponseForbidden, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone

from games.models import Game

from .forms import CommentForm, GamerProfileForm, PostForm, SignupForm
from .models import Block, Comment, Conversation, ConversationParticipant, Follow, FriendRequest, Friendship, GamerProfile, Message, MessageRequest, Notification, Post, PostLike, Report, RespectTransaction, notify


def _notify(recipient, actor, notification_type, message, target_url=""):
	notify(recipient, actor, notification_type, message, target_url)


def _can_message(sender, recipient):
	if sender == recipient or Block.objects.filter(Q(blocker=sender, blocked=recipient) | Q(blocker=recipient, blocked=sender)).exists():
		return False
	first, second = sorted((sender.id, recipient.id))
	return Friendship.objects.filter(profile_one_id=first, profile_two_id=second).exists() or (Follow.objects.filter(follower=sender, following=recipient).exists() and Follow.objects.filter(follower=recipient, following=sender).exists()) or MessageRequest.objects.filter(Q(sender=sender, recipient=recipient) | Q(sender=recipient, recipient=sender), status="Accepted").exists()


def gamer_discovery(request):
	profiles = GamerProfile.objects.select_related("user").prefetch_related("games")
	query = request.GET.get("q", "").strip()
	location = request.GET.get("location", "").strip()
	platform = request.GET.get("platform", "").strip()
	rank = request.GET.get("rank", "").strip()
	availability = request.GET.get("availability", "").strip()
	game_id = request.GET.get("game", "").strip()

	if query:
		profiles = profiles.filter(
			Q(gamer_tag__icontains=query) | Q(user__username__icontains=query)
		)
	if location:
		profiles = profiles.filter(location__icontains=location)
	if platform:
		profiles = profiles.filter(platform=platform)
	if rank:
		profiles = profiles.filter(rank=rank)
	if availability:
		profiles = profiles.filter(availability=availability)
	if game_id:
		profiles = profiles.filter(games__id=game_id)
	viewer = getattr(request.user, "gamer_profile", None)
	if viewer:
		blocked_ids = Block.objects.filter(Q(blocker=viewer) | Q(blocked=viewer)).values_list("blocker_id", "blocked_id")
		profiles = profiles.exclude(id__in={value for pair in blocked_ids for value in pair})

	page = Paginator(profiles.order_by("gamer_tag"), 12).get_page(
		request.GET.get("page")
	)
	return render(
		request,
		"accounts/gamer_discovery.html",
		{
			"page": page,
			"query": query,
			"location": location,
			"platform_choices": GamerProfile.PLATFORM_CHOICES,
			"rank_choices": GamerProfile.RANK_CHOICES,
			"availability_choices": GamerProfile.AVAILABILITY_CHOICES,
			"game_choices": Game.objects.order_by("name"),
		},
	)


@login_required
def dashboard(request):
	profile = getattr(request.user, "gamer_profile", None)
	return render(
		request,
		"accounts/dashboard.html",
		{
			"profile": profile,
			"game_count": profile.games.count() if profile else 0,
			"gamer_count": GamerProfile.objects.exclude(user=request.user).count(),
		},
	)


def profile_detail(request, gamer_tag):
	profile = get_object_or_404(
		GamerProfile.objects.select_related("user").prefetch_related("games", "posts__game"),
		gamer_tag=gamer_tag,
	)
	viewer = getattr(request.user, "gamer_profile", None)
	friendship = None
	friend_request = None
	is_following = False
	is_blocked = False
	message_request = None
	message_request_incoming = None
	profile_posts = profile.posts.all()
	if viewer and viewer != profile:
		first, second = sorted((viewer.id, profile.id))
		friendship = Friendship.objects.filter(
			profile_one_id=first, profile_two_id=second
		).first()
		friend_request = FriendRequest.objects.filter(
			Q(sender=viewer, receiver=profile) | Q(sender=profile, receiver=viewer),
			status="pending",
		).first()
		is_following = Follow.objects.filter(follower=viewer, following=profile).exists()
		is_blocked = Block.objects.filter(Q(blocker=viewer, blocked=profile) | Q(blocker=profile, blocked=viewer)).exists()
		message_request = MessageRequest.objects.filter(sender=viewer, recipient=profile).first()
		message_request_incoming = MessageRequest.objects.filter(sender=profile, recipient=viewer).first()
		if is_blocked:
			profile_posts = Post.objects.none()
	return render(
		request,
		"accounts/profile_detail.html",
		{
			"profile": profile,
			"friendship": friendship,
			"friend_request": friend_request,
			"is_following": is_following,
			"is_blocked": is_blocked,
			"message_request": message_request,
			"message_request_incoming": message_request_incoming,
			"profile_posts": profile_posts,
			"follower_count": profile.followers.count(),
			"following_count": profile.following.count(),
			"friend_count": Friendship.objects.filter(
				Q(profile_one=profile) | Q(profile_two=profile)
			).count(),
			"respect_giver_count": profile.respect_received.count(),
		},
	)


@login_required
def connection_action(request, gamer_tag, action):
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	target = get_object_or_404(GamerProfile, gamer_tag=gamer_tag)
	viewer = get_object_or_404(GamerProfile, user=request.user)
	if target == viewer:
		return HttpResponseForbidden("You cannot interact with your own profile.")
	if action == "follow":
		if not Block.objects.filter(Q(blocker=target, blocked=viewer) | Q(blocker=viewer, blocked=target)).exists():
			created = Follow.objects.get_or_create(follower=viewer, following=target)[1]
			if created:
				_notify(target, viewer, "follow", f"{viewer.gamer_tag} followed you", f"/profiles/{viewer.gamer_tag}/")
	elif action == "unfollow":
		Follow.objects.filter(follower=viewer, following=target).delete()
	elif action == "friend":
		if not Block.objects.filter(
			Q(blocker=target, blocked=viewer) | Q(blocker=viewer, blocked=target)
		).exists():
			FriendRequest.objects.update_or_create(
				sender=viewer, receiver=target,
				defaults={"status": "pending"},
			)
			_notify(target, viewer, "friend_request", f"{viewer.gamer_tag} sent you a friend request", f"/profiles/{viewer.gamer_tag}/")
	elif action in {"cancel", "reject"}:
		FriendRequest.objects.filter(
			sender=viewer if action == "cancel" else target,
			receiver=target if action == "cancel" else viewer,
			status="pending",
		).update(status="cancelled" if action == "cancel" else "rejected")
	elif action == "accept":
		friend_request = get_object_or_404(
			FriendRequest, sender=target, receiver=viewer, status="pending"
		)
		first, second = sorted((viewer.id, target.id))
		Friendship.objects.get_or_create(profile_one_id=first, profile_two_id=second)
		friend_request.delete()
		_notify(target, viewer, "friend_accept", f"{viewer.gamer_tag} accepted your friend request", f"/profiles/{viewer.gamer_tag}/")
	elif action == "remove":
		first, second = sorted((viewer.id, target.id))
		Friendship.objects.filter(profile_one_id=first, profile_two_id=second).delete()
	elif action == "block":
		Block.objects.get_or_create(blocker=viewer, blocked=target)
		Follow.objects.filter(
			Q(follower=viewer, following=target) | Q(follower=target, following=viewer)
		).delete()
		FriendRequest.objects.filter(
			Q(sender=viewer, receiver=target) | Q(sender=target, receiver=viewer)
		).delete()
		first, second = sorted((viewer.id, target.id))
		Friendship.objects.filter(profile_one_id=first, profile_two_id=second).delete()
	elif action == "unblock":
		Block.objects.filter(blocker=viewer, blocked=target).delete()
	elif action == "respect":
		if Block.objects.filter(
			Q(blocker=target, blocked=viewer) | Q(blocker=viewer, blocked=target)
		).exists():
			return HttpResponseForbidden("Blocked users cannot exchange respect.")
		created = RespectTransaction.objects.get_or_create(
			giver=viewer, recipient=target
		)[1]
		if created:
			GamerProfile.objects.filter(id=target.id).update(
				respect_points=F("respect_points") + 1
			)
			_notify(target, viewer, "respect", f"{viewer.gamer_tag} gave you Respect", f"/profiles/{viewer.gamer_tag}/")
	elif action == "report":
		Report.objects.get_or_create(reporter=viewer, reported_profile=target)
	else:
		return HttpResponseForbidden("Unknown connection action.")
	messages.success(request, "Your community action was updated.")
	if request.headers.get("x-requested-with") == "XMLHttpRequest":
		return JsonResponse({"ok": True, "action": action})
	return redirect("profile_detail", gamer_tag=target.gamer_tag)


def _visible_posts(viewer):
	posts = Post.objects.select_related("author__user", "game").prefetch_related("likes", "comments__author")
	if viewer:
		blocked_ids = Block.objects.filter(
			Q(blocker=viewer) | Q(blocked=viewer)
		).values_list("blocker_id", "blocked_id")
		blocked_profile_ids = set()
		for blocker_id, blocked_id in blocked_ids:
			blocked_profile_ids.update((blocker_id, blocked_id))
		posts = posts.exclude(author_id__in=blocked_profile_ids)
	return posts


def feed(request):
	viewer = getattr(request.user, "gamer_profile", None)
	posts = _visible_posts(viewer)
	tab = request.GET.get("tab", "latest")
	if tab == "following" and viewer:
		posts = posts.filter(author__in=viewer.following.all())
	elif tab == "for-you" and viewer:
		posts = posts.filter(
			Q(author__location=viewer.location) | Q(author__games__in=viewer.games.all())
		).distinct()
	page = Paginator(posts, 10).get_page(request.GET.get("page"))
	liked_post_ids = set(PostLike.objects.filter(user=viewer, post__in=page.object_list).values_list("post_id", flat=True)) if viewer else set()
	return render(request, "accounts/feed.html", {"page": page, "tab": tab, "post_form": PostForm(), "liked_post_ids": liked_post_ids})


@login_required
def post_create(request):
	if request.method != "POST":
		return redirect("feed")
	form = PostForm(request.POST, request.FILES)
	if form.is_valid():
		post = form.save(commit=False)
		post.author = get_object_or_404(GamerProfile, user=request.user)
		post.save()
		_notify(post.author, get_object_or_404(GamerProfile, user=request.user), "post", f"{post.author.gamer_tag} published a post", f"/feed/posts/{post.id}/")
		messages.success(request, "Your post is live in the community feed.")
	return redirect("feed")


@login_required
def post_edit(request, post_id):
	post = get_object_or_404(Post, id=post_id, author__user=request.user)
	form = PostForm(request.POST or None, request.FILES or None, instance=post)
	if form.is_valid():
		form.save()
		messages.success(request, "Your post was updated.")
		return redirect("post_detail", post_id=post.id)
	return render(request, "accounts/post_edit.html", {"form": form, "post": post})


@login_required
def post_delete(request, post_id):
	post = get_object_or_404(Post, id=post_id, author__user=request.user)
	if request.method == "POST":
		post.delete()
		messages.success(request, "Your post was deleted.")
	return redirect("feed")


def post_detail(request, post_id):
	post = get_object_or_404(_visible_posts(getattr(request.user, "gamer_profile", None)), id=post_id)
	form = CommentForm(request.POST or None)
	if request.method == "POST" and request.user.is_authenticated:
		if form.is_valid():
			comment = form.save(commit=False)
			comment.post = post
			comment.author = get_object_or_404(GamerProfile, user=request.user)
			if Block.objects.filter(Q(blocker=comment.author, blocked=post.author) | Q(blocker=post.author, blocked=comment.author)).exists():
				return redirect("post_detail", post_id=post.id)
			comment.save()
			if comment.post.author != comment.author:
				_notify(comment.post.author, comment.author, "comment", f"{comment.author.gamer_tag} commented on your post", f"/feed/posts/{comment.post.id}/")
			return redirect("post_detail", post_id=post.id)
	viewer = getattr(request.user, "gamer_profile", None)
	liked_post_ids = {post.id} if viewer and PostLike.objects.filter(post=post, user=viewer).exists() else set()
	return render(request, "accounts/post_detail.html", {"post": post, "comment_form": form, "liked_post_ids": liked_post_ids})


@login_required
def post_like(request, post_id):
	post = get_object_or_404(_visible_posts(getattr(request.user, "gamer_profile", None)), id=post_id)
	if request.method == "POST":
		profile = get_object_or_404(GamerProfile, user=request.user)
		like, created = PostLike.objects.get_or_create(post=post, user=profile)
		if not created:
			like.delete()
		elif post.author != profile:
			_notify(post.author, profile, "like", f"{profile.gamer_tag} liked your post", f"/feed/posts/{post.id}/")
	if request.headers.get("x-requested-with") == "XMLHttpRequest":
		return JsonResponse({"ok": True, "liked": created, "count": post.likes.count()})
	return redirect(request.POST.get("next") or "feed")


@login_required
def post_report(request, post_id):
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	post = get_object_or_404(_visible_posts(getattr(request.user, "gamer_profile", None)), id=post_id)
	reporter = get_object_or_404(GamerProfile, user=request.user)
	Report.objects.get_or_create(reporter=reporter, post=post)
	return redirect("post_detail", post_id=post.id)


@login_required
def notification_list(request):
	profile = get_object_or_404(GamerProfile, user=request.user)
	notifications = profile.notifications.all()
	return render(request, "accounts/notification_list.html", {"notifications": notifications, "unread_count": notifications.filter(is_read=False).count()})


@login_required
def notification_read(request, notification_id):
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	profile = get_object_or_404(GamerProfile, user=request.user)
	notification = get_object_or_404(Notification, id=notification_id, recipient=profile)
	notification.is_read = True
	notification.save(update_fields=("is_read",))
	return redirect(notification.target_url or "notification_list")


@login_required
def notification_unread(request, notification_id):
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	profile = get_object_or_404(GamerProfile, user=request.user)
	Notification.objects.filter(id=notification_id, recipient=profile).update(is_read=False)
	return redirect("notification_list")


@login_required
def notifications_read_all(request):
	if request.method == "POST":
		Notification.objects.filter(recipient__user=request.user, is_read=False).update(is_read=True)
	return redirect("notification_list")


@login_required
def conversation_list(request):
	profile = get_object_or_404(GamerProfile, user=request.user)
	conversations = Conversation.objects.filter(participants=profile).prefetch_related("participants", "messages", "participant_links")
	for conversation in conversations:
		conversation.other = conversation.participants.exclude(id=profile.id).first()
		participant = conversation.participant_links.get(profile=profile)
		visible_messages = conversation.messages.filter(created_at__gt=participant.cleared_at) if participant.cleared_at else conversation.messages.all()
		conversation.last_message = visible_messages.last()
		unread_messages = visible_messages.exclude(sender=profile)
		conversation.unread_count = unread_messages.filter(created_at__gt=participant.last_read_at).count() if participant.last_read_at else unread_messages.count()
	return render(request, "accounts/conversation_list.html", {"conversations": conversations, "profile": profile})


@login_required
def conversation_detail(request, conversation_id):
	profile = get_object_or_404(GamerProfile, user=request.user)
	conversation = get_object_or_404(Conversation.objects.prefetch_related("participants", "messages__sender"), id=conversation_id, participants=profile)
	participant = get_object_or_404(ConversationParticipant, conversation=conversation, profile=profile)
	other = conversation.participants.exclude(id=profile.id).first()
	if other and Block.objects.filter(Q(blocker=profile, blocked=other) | Q(blocker=other, blocked=profile)).exists():
		return HttpResponseForbidden("You cannot access this conversation.")
	if request.method == "POST":
		if request.POST.get("action") == "clear":
			participant.cleared_at = timezone.now()
			participant.last_read_at = participant.cleared_at
			participant.save(update_fields=("cleared_at", "last_read_at"))
			messages.success(request, "Conversation cleared for you.")
			return redirect("conversation_detail", conversation_id=conversation.id)
		body = request.POST.get("body", "").strip()
		other = conversation.participants.exclude(id=profile.id).first()
		if body and other and _can_message(profile, other):
			Message.objects.create(conversation=conversation, sender=profile, body=body)
			conversation.save(update_fields=("updated_at",))
			_notify(other, profile, "message", f"{profile.gamer_tag} sent you a message", f"/messages/{conversation.id}/")
		return redirect("conversation_detail", conversation_id=conversation.id)
	ConversationParticipant.objects.filter(conversation=conversation, profile=profile).update(last_read_at=timezone.now())
	messages_qs = conversation.messages.filter(created_at__gt=participant.cleared_at) if participant.cleared_at else conversation.messages.all()
	return render(request, "accounts/conversation_detail.html", {"conversation": conversation, "profile": profile, "other": conversation.participants.exclude(id=profile.id).first(), "conversation_messages": messages_qs})


@login_required
def conversation_start(request, gamer_tag):
	profile = get_object_or_404(GamerProfile, user=request.user)
	other = get_object_or_404(GamerProfile, gamer_tag=gamer_tag)
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	if not _can_message(profile, other):
		return HttpResponseForbidden("You cannot message this gamer.")
	conversation = Conversation.objects.filter(participants=profile).filter(participants=other).first()
	if not conversation:
		conversation = Conversation.objects.create()
		ConversationParticipant.objects.bulk_create([ConversationParticipant(conversation=conversation, profile=profile), ConversationParticipant(conversation=conversation, profile=other)])
	return redirect("conversation_detail", conversation_id=conversation.id)


@login_required
def message_request_action(request, gamer_tag, action):
	if request.method != "POST" or action not in ("send", "accept", "decline", "delete"):
		return HttpResponseForbidden("Invalid message request action.")
	profile = get_object_or_404(GamerProfile, user=request.user)
	other = get_object_or_404(GamerProfile, gamer_tag=gamer_tag)
	if profile == other or Block.objects.filter(Q(blocker=profile, blocked=other) | Q(blocker=other, blocked=profile)).exists():
		return HttpResponseForbidden("You cannot message this player.")
	if action == "send":
		request_row = MessageRequest.objects.filter(sender=profile, recipient=other).first()
		created = request_row is None
		if created:
			request_row = MessageRequest.objects.create(sender=profile, recipient=other)
		elif request_row.status == "Declined":
			request_row.status = "Pending"
			request_row.save(update_fields=("status",))
		if created or request_row.status == "Pending":
			_notify(other, profile, "message_request", f"{profile.gamer_tag} sent you a message request", f"/profiles/{profile.gamer_tag}/")
	elif action == "delete":
		request_row = get_object_or_404(MessageRequest, Q(sender=profile, recipient=other) | Q(sender=other, recipient=profile))
		request_row.delete()
		return redirect("profile_detail", gamer_tag=other.gamer_tag)
	else:
		request_row = get_object_or_404(MessageRequest, sender=other, recipient=profile)
		if action == "accept":
			request_row.status = "Accepted"
			_notify(other, profile, "message_request", f"{profile.gamer_tag} accepted your message request", f"/profiles/{profile.gamer_tag}/")
		elif action == "decline":
			request_row.status = "Declined"
		else:
			request_row.delete()
			return redirect("profile_detail", gamer_tag=other.gamer_tag)
		request_row.save(update_fields=("status",))
	return redirect("profile_detail", gamer_tag=other.gamer_tag)


@login_required
def profile_edit(request, gamer_tag):
	profile = get_object_or_404(GamerProfile, gamer_tag=gamer_tag)
	if request.user != profile.user:
		return HttpResponseForbidden("You can only edit your own profile.")

	form = GamerProfileForm(
		request.POST or None,
		request.FILES or None,
		instance=profile,
	)
	if form.is_valid():
		updated_profile = form.save()
		return redirect("profile_detail", gamer_tag=updated_profile.gamer_tag)

	return render(
		request,
		"accounts/profile_edit.html",
		{"form": form, "profile": profile},
	)


def signup(request):
	form = SignupForm(request.POST or None)
	if form.is_valid():
		user = form.save()
		login(request, user)
		return redirect("profile_detail", gamer_tag=user.gamer_profile.gamer_tag)

	return render(request, "accounts/signup.html", {"form": form})
