from django.shortcuts import render

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect
from django.core.paginator import Paginator

from accounts.models import GamerProfile
from .models import Event, EventRsvp
from .forms import EventForm


def event_list(request):
	events = Event.objects.filter(status__in=("Upcoming", "Live")).select_related("organizer", "game").prefetch_related("rsvps")
	if request.GET.get("q"):
		events = events.filter(name__icontains=request.GET["q"])
	page = Paginator(events, 12).get_page(request.GET.get("page"))
	return render(request, "events/event_list.html", {"page": page})


def event_detail(request, event_id):
	event = get_object_or_404(Event.objects.select_related("organizer", "game").prefetch_related("rsvps__attendee"), id=event_id)
	return render(request, "events/event_detail.html", {"event": event})


@login_required
def event_rsvp(request, event_id):
	event = get_object_or_404(Event, id=event_id)
	if request.method == "POST" and event.status == "Upcoming" and (not event.capacity or event.rsvps.count() < event.capacity):
		EventRsvp.objects.get_or_create(event=event, attendee=get_object_or_404(GamerProfile, user=request.user))
	return redirect("event_detail", event_id=event.id)


@login_required
def event_leave(request, event_id):
	if request.method == "POST":
		EventRsvp.objects.filter(event_id=event_id, attendee__user=request.user).delete()
	return redirect("event_detail", event_id=event_id)


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
