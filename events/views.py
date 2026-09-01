from django.shortcuts import render

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect
from django.core.paginator import Paginator
from django.db.models import Q
from django.utils.text import slugify

from accounts.models import GamerProfile
from .forms import EventForm, EventPromotionRequestForm, OrganizationForm, OrganizationLocationForm
from .models import Event, EventPromotionRequest, EventRsvp, Organization, OrganizationLocation


def event_list(request):
	events = Event.objects.filter(status__in=("Published", "Upcoming", "Live")).select_related("organizer", "game").prefetch_related("rsvps")
	if request.GET.get("q"):
		events = events.filter(name__icontains=request.GET["q"])
	if request.GET.get("game"):
		events = events.filter(game_id=request.GET["game"])
	if request.GET.get("location"):
		events = events.filter(location__icontains=request.GET["location"])
	if request.GET.get("status"):
		events = events.filter(status=request.GET["status"])
	page = Paginator(events.order_by("start_date", "id"), 12).get_page(request.GET.get("page"))
	from games.models import Game
	return render(request, "events/event_list.html", {"page": page, "game_choices": Game.objects.order_by("name"), "event_status_choices": Event.STATUS_CHOICES})


@login_required
def event_my(request):
	profile = get_object_or_404(GamerProfile, user=request.user)
	events = Event.objects.filter(organizer=profile).select_related("game").prefetch_related("rsvps")
	return render(request, "events/event_my.html", {"events": events})


def event_detail(request, event_id):
	event = get_object_or_404(Event.objects.select_related("organizer", "game", "organization").prefetch_related("rsvps__attendee"), id=event_id)
	profile = getattr(request.user, "gamer_profile", None) if request.user.is_authenticated else None
	is_organizer = bool(profile and event.organizer_id == profile.id)
	is_rsvped = bool(profile and event.rsvps.filter(attendee=profile).exists())
	spots_remaining = None if not event.capacity else max(event.capacity - event.rsvps.count(), 0)
	return render(request, "events/event_detail.html", {"event": event, "profile": profile, "is_organizer": is_organizer, "is_rsvped": is_rsvped, "spots_remaining": spots_remaining})


@login_required
def event_rsvp(request, event_id):
	event = get_object_or_404(Event, id=event_id)
	profile = get_object_or_404(GamerProfile, user=request.user)
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	if event.status in ("Draft", "Cancelled", "Completed"):
		messages.error(request, "This event is not accepting RSVPs.")
		return redirect("event_detail", event_id=event.id)
	if event.rsvps.filter(attendee=profile).exists():
		messages.info(request, "You are already RSVP'd for this event.")
		return redirect("event_detail", event_id=event.id)
	if event.capacity and event.rsvps.count() >= event.capacity:
		messages.error(request, "This event is full.")
		return redirect("event_detail", event_id=event.id)
	EventRsvp.objects.create(event=event, attendee=profile)
	messages.success(request, "Your RSVP has been saved.")
	return redirect("event_detail", event_id=event.id)


@login_required
def event_leave(request, event_id):
	if request.method == "POST":
		EventRsvp.objects.filter(event_id=event_id, attendee__user=request.user).delete()
		messages.success(request, "Your RSVP was removed.")
	return redirect("event_detail", event_id=event_id)


@login_required
def event_publish(request, event_id):
	event = get_object_or_404(Event, id=event_id, organizer__user=request.user)
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	if event.status == "Cancelled":
		messages.error(request, "A cancelled event cannot be published.")
		return redirect("event_detail", event_id=event.id)
	event.status = "Upcoming" if event.status in ("Draft", "Published") else event.status
	event.save(update_fields=("status",))
	messages.success(request, "Your event is now live for RSVPs.")
	return redirect("event_detail", event_id=event.id)


@login_required
def organization_dashboard(request, slug):
	profile = get_object_or_404(GamerProfile, user=request.user)
	organization = get_object_or_404(Organization.objects.select_related("owner__user").prefetch_related("events", "promotion_requests", "locations"), slug=slug)
	if organization.owner_id != profile.id:
		return HttpResponseForbidden("You are not the owner of this organization.")
	return render(request, "events/organization_dashboard.html", {
		"organization": organization,
		"events": organization.events.all(),
		"promotion_requests": organization.promotion_requests.all(),
		"locations": organization.locations.all(),
	})


@login_required
def organization_portal(request):
	profile = get_object_or_404(GamerProfile, user=request.user)
	organization = Organization.objects.filter(owner=profile).order_by("name").first()
	if organization is None:
		return redirect("organization_create")
	return redirect("organization_portal_dashboard", slug=organization.slug)


def organization_public_profile(request, slug):
	organization = get_object_or_404(
		Organization.objects.prefetch_related("locations__games", "locations__reviews__author__user", "events__game"),
		slug=slug,
	)
	locations = organization.locations.filter(public_visible=True).order_by("name")
	profile = getattr(request.user, "gamer_profile", None) if request.user.is_authenticated else None
	return render(request, "events/organization_public_profile.html", {
		"organization": organization,
		"locations": locations,
		"events": organization.events.filter(status__in=("Published", "Upcoming", "Live")).order_by("start_date")[:6],
		"is_owner": bool(profile and organization.owner_id == profile.id),
		"promotion_requests": organization.promotion_requests.all() if profile and organization.owner_id == profile.id else [],
	})


def organization_list(request):
	query = (request.GET.get("q") or "").strip()
	organizations = Organization.objects.filter(locations__public_visible=True).prefetch_related("locations").distinct().order_by("name")
	if query:
		organizations = organizations.filter(
			Q(name__icontains=query)
			| Q(description__icontains=query)
			| Q(organization_type__icontains=query)
			| Q(city__icontains=query)
			| Q(country__icontains=query)
			| Q(locations__name__icontains=query)
		).distinct()
	return render(request, "events/organization_list.html", {"organizations": organizations, "query": query})


@login_required
def organization_location_create(request, slug):
	profile = get_object_or_404(GamerProfile, user=request.user)
	organization = get_object_or_404(Organization.objects.select_related("owner__user"), slug=slug)
	if organization.owner_id != profile.id:
		return HttpResponseForbidden("You are not the owner of this organization.")
	form = OrganizationLocationForm(request.POST or None)
	if request.method == "POST" and form.is_valid():
		location = form.save(commit=False, organization=organization)
		location.save()
		messages.success(request, "Your gaming location was added to GGz Radar.")
		return redirect("organization_portal_dashboard", slug=organization.slug)
	return render(request, "events/organization_location_form.html", {
		"form": form,
		"organization": organization,
		"title": "Add Radar location",
		"map_provider": getattr(settings, "GGZ_MAP_PROVIDER", "google"),
		"map_api_key": getattr(settings, "GGZ_MAP_API_KEY", ""),
		"map_id": getattr(settings, "GGZ_MAP_ID", ""),
		"map_default_lat": getattr(settings, "GGZ_MAP_DEFAULT_LATITUDE", -17.8252),
		"map_default_lng": getattr(settings, "GGZ_MAP_DEFAULT_LONGITUDE", 31.0335),
	})


@login_required
def organization_location_edit(request, slug, location_id):
	profile = get_object_or_404(GamerProfile, user=request.user)
	organization = get_object_or_404(Organization, slug=slug)
	if organization.owner_id != profile.id:
		return HttpResponseForbidden("You are not the owner of this organization.")
	location = get_object_or_404(OrganizationLocation, pk=location_id, organization=organization)
	form = OrganizationLocationForm(request.POST or None, instance=location)
	if request.method == "POST" and form.is_valid():
		form.save()
		messages.success(request, "Your Radar location was updated.")
		return redirect("organization_portal_dashboard", slug=organization.slug)
	return render(request, "events/organization_location_form.html", {
		"form": form,
		"organization": organization,
		"location": location,
		"title": "Edit Radar location",
		"map_provider": getattr(settings, "GGZ_MAP_PROVIDER", "google"),
		"map_api_key": getattr(settings, "GGZ_MAP_API_KEY", ""),
		"map_id": getattr(settings, "GGZ_MAP_ID", ""),
		"map_default_lat": location.latitude or getattr(settings, "GGZ_MAP_DEFAULT_LATITUDE", -17.8252),
		"map_default_lng": location.longitude or getattr(settings, "GGZ_MAP_DEFAULT_LONGITUDE", 31.0335),
	})


@login_required
def organization_location_visibility(request, slug, location_id, action):
	profile = get_object_or_404(GamerProfile, user=request.user)
	organization = get_object_or_404(Organization, slug=slug)
	if organization.owner_id != profile.id:
		return HttpResponseForbidden("You are not the owner of this organization.")
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	location = get_object_or_404(OrganizationLocation, pk=location_id, organization=organization)
	if action == "activate":
		if location.latitude is None or location.longitude is None:
			messages.error(request, "Add a valid map location before activating this venue.")
		else:
			location.public_visible = True
			location.save(update_fields=("public_visible", "updated_at"))
			messages.success(request, "Your location is now discoverable on GGz Radar.")
	elif action == "deactivate":
		location.public_visible = False
		location.save(update_fields=("public_visible", "updated_at"))
		messages.success(request, "Your location was removed from public Radar discovery.")
	else:
		return HttpResponseForbidden("Invalid location action.")
	return redirect("organization_portal_dashboard", slug=organization.slug)


@login_required
def organization_create(request):
	profile = get_object_or_404(GamerProfile, user=request.user)
	form = OrganizationForm(request.POST or None, request.FILES or None)
	if request.method == "POST" and form.is_valid():
		organization = form.save(commit=False, owner=profile)
		organization.slug = slugify(organization.name) or "organization"
		if Organization.objects.filter(slug=organization.slug).exists():
			organization.slug = f"{organization.slug}-{profile.user_id}"
			if Organization.objects.filter(slug=organization.slug).exists():
				organization.slug = f"{organization.slug}-{Organization.objects.count() + 1}"
		organization.save()
		messages.success(request, "Your organization was created.")
		return redirect("organization_portal_dashboard", slug=organization.slug)
	return render(request, "events/organization_form.html", {"form": form, "title": "Create organization"})


@login_required
def organization_edit(request, slug):
	profile = get_object_or_404(GamerProfile, user=request.user)
	organization = get_object_or_404(Organization, slug=slug)
	if organization.owner_id != profile.id:
		return HttpResponseForbidden("You are not the owner of this organization.")
	form = OrganizationForm(request.POST or None, request.FILES or None, instance=organization)
	if request.method == "POST" and form.is_valid():
		form.save()
		messages.success(request, "Your organization profile was updated.")
		return redirect("organization_portal_dashboard", slug=organization.slug)
	return render(request, "events/organization_form.html", {"form": form, "organization": organization, "title": "Edit organization profile"})


@login_required
def event_create(request):
	form = EventForm(request.POST or None, request.FILES or None)
	if form.is_valid():
		event = form.save(commit=False)
		event.organizer = get_object_or_404(GamerProfile, user=request.user)
		event.save()
		messages.success(request, "Your event was created.")
		return redirect("event_detail", event_id=event.id)
	return render(request, "events/event_form.html", {"form": form, "title": "Create event"})


@login_required
def event_edit(request, event_id):
	event = get_object_or_404(Event, id=event_id, organizer__user=request.user)
	form = EventForm(request.POST or None, request.FILES or None, instance=event)
	if form.is_valid():
		form.save()
		messages.success(request, "Your event was updated.")
		return redirect("event_detail", event_id=event.id)
	return render(request, "events/event_form.html", {"form": form, "title": "Edit event", "event": event})


@login_required
def event_cancel(request, event_id):
	event = get_object_or_404(Event, id=event_id, organizer__user=request.user)
	if request.method == "POST":
		event.status = "Cancelled"
		event.save(update_fields=("status",))
		messages.success(request, "Your event was cancelled.")
	return redirect("event_detail", event_id=event.id)


@login_required
def event_delete(request, event_id):
	event = get_object_or_404(Event, id=event_id, organizer__user=request.user)
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	event.delete()
	messages.success(request, "Your event was deleted.")
	return redirect("event_list")


@login_required
def event_promotion_request(request, event_id):
	event = get_object_or_404(Event, id=event_id, organizer__user=request.user)
	profile = get_object_or_404(GamerProfile, user=request.user)
	allowed_orgs = Organization.objects.filter(owner=profile)
	if not allowed_orgs.exists():
		return HttpResponseForbidden("You must create an organization before requesting event promotion.")
	default_organization = event.organization if event.organization and event.organization.owner == profile else allowed_orgs.first()
	form = EventPromotionRequestForm(request.POST or None)
	if request.method == "POST" and form.is_valid():
		promotion = form.save(commit=False)
		promotion.event = event
		promotion.requesting_organization = default_organization
		promotion.status = "Pending"
		promotion.save()
		messages.success(request, "Your promotion request was submitted.")
		return redirect("event_detail", event_id=event.id)
	return render(request, "events/promotion_request_form.html", {"form": form, "event": event})


@login_required
def event_promotion_review(request, request_id, action):
	promotion = get_object_or_404(EventPromotionRequest, id=request_id)
	profile = get_object_or_404(GamerProfile, user=request.user)
	if not (promotion.event.organizer == profile or promotion.requesting_organization.owner == profile or request.user.is_staff):
		return HttpResponseForbidden("You are not authorized to review this promotion request.")
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	if action == "approve":
		promotion.status = "Approved"
		promotion.event.featured = True
		promotion.event.save(update_fields=("featured",))
		promotion.reviewer = profile
		promotion.review_notes = request.POST.get("review_notes", promotion.review_notes)
		promotion.save(update_fields=("status", "reviewer", "review_notes", "updated_at"))
		messages.success(request, "The event promotion request was approved.")
	elif action == "reject":
		promotion.status = "Rejected"
		promotion.event.featured = False
		promotion.event.save(update_fields=("featured",))
		promotion.reviewer = profile
		promotion.review_notes = request.POST.get("review_notes", promotion.review_notes)
		promotion.save(update_fields=("status", "reviewer", "review_notes", "updated_at"))
		messages.success(request, "The event promotion request was rejected.")
	elif action == "under_review":
		promotion.status = "Under Review"
		promotion.reviewer = profile
		promotion.review_notes = request.POST.get("review_notes", promotion.review_notes)
		promotion.save(update_fields=("status", "reviewer", "review_notes", "updated_at"))
		messages.success(request, "The event promotion request is under review.")
	else:
		return HttpResponseForbidden("Invalid review action.")
	return redirect("event_detail", event_id=promotion.event.id)
