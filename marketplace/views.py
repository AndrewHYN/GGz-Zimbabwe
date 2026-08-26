from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render

from accounts.models import GamerProfile, Notification, Report
from games.models import Game

from .forms import ListingForm, ListingImageForm
from .models import Listing, ListingImage, SavedListing


def listing_list(request):
	listings = Listing.objects.filter(status__in=("Available", "Reserved")).select_related("seller", "game").prefetch_related("images")
	query = request.GET.get("q", "").strip()
	if query:
		listings = listings.filter(Q(title__icontains=query) | Q(description__icontains=query) | Q(location__icontains=query) | Q(game__name__icontains=query))
	for field in ("category", "condition", "platform", "location"):
		value = request.GET.get(field, "").strip()
		if value:
			listings = listings.filter(**{f"{field}__icontains": value})
	if request.GET.get("min_price"):
		listings = listings.filter(price__gte=request.GET["min_price"])
	if request.GET.get("max_price"):
		listings = listings.filter(price__lte=request.GET["max_price"])
	if request.GET.get("game"):
		listings = listings.filter(game_id=request.GET["game"])
	sort = request.GET.get("sort", "newest")
	listings = listings.order_by("price" if sort == "cheapest" else "-price" if sort == "expensive" else "-created_at")
	page = Paginator(listings, 12).get_page(request.GET.get("page"))
	return render(request, "marketplace/listing_list.html", {"page": page, "game_choices": Game.objects.order_by("name"), "category_choices": Listing.CATEGORY_CHOICES, "condition_choices": Listing.CONDITION_CHOICES})


def listing_detail(request, listing_id):
	listing = get_object_or_404(Listing.objects.select_related("seller__user", "game").prefetch_related("images"), id=listing_id)
	viewer = getattr(request.user, "gamer_profile", None)
	return render(request, "marketplace/listing_detail.html", {"listing": listing, "is_saved": bool(viewer and SavedListing.objects.filter(user=viewer, listing=listing).exists())})


@login_required
def listing_create(request):
	form = ListingForm(request.POST or None)
	if form.is_valid():
		listing = form.save(commit=False)
		listing.seller = get_object_or_404(GamerProfile, user=request.user)
		listing.save()
		for image in request.FILES.getlist("images"):
			image_form = ListingImageForm({"image": image}, {"image": image})
			if image_form.is_valid():
				ListingImage.objects.create(listing=listing, image=image)
		messages.success(request, "Your listing is live.")
		return redirect("listing_detail", listing_id=listing.id)
	return render(request, "marketplace/listing_form.html", {"form": form, "title": "Create listing"})


@login_required
def listing_edit(request, listing_id):
	listing = get_object_or_404(Listing, id=listing_id, seller__user=request.user)
	form = ListingForm(request.POST or None, instance=listing)
	if form.is_valid():
		form.save()
		for image in request.FILES.getlist("images"):
			image_form = ListingImageForm({"image": image}, {"image": image})
			if image_form.is_valid():
				ListingImage.objects.create(listing=listing, image=image)
		messages.success(request, "Your listing was updated.")
		return redirect("listing_detail", listing_id=listing.id)
	return render(request, "marketplace/listing_form.html", {"form": form, "title": "Edit listing", "listing": listing})


@login_required
def listing_delete(request, listing_id):
	listing = get_object_or_404(Listing, id=listing_id, seller__user=request.user)
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	listing.delete()
	messages.success(request, "Your listing was deleted.")
	return redirect("listing_list")


@login_required
def listing_status(request, listing_id, status):
	listing = get_object_or_404(Listing, id=listing_id, seller__user=request.user)
	if request.method != "POST" or status not in ("Reserved", "Sold"):
		return HttpResponseForbidden("Invalid listing action.")
	listing.status = status
	listing.save(update_fields=("status", "updated_at"))
	messages.success(request, f"Listing marked {status.lower()}.")
	return redirect("listing_detail", listing_id=listing.id)


@login_required
def listing_save(request, listing_id):
	listing = get_object_or_404(Listing, id=listing_id)
	if request.method != "POST":
		return HttpResponseForbidden("This action requires POST.")
	viewer = get_object_or_404(GamerProfile, user=request.user)
	saved, created = SavedListing.objects.get_or_create(user=viewer, listing=listing)
	if not created:
		saved.delete()
	return redirect("listing_detail", listing_id=listing.id)


@login_required
def listing_report(request, listing_id):
	listing = get_object_or_404(Listing, id=listing_id)
	viewer = get_object_or_404(GamerProfile, user=request.user)
	if request.method == "POST" and listing.seller != viewer:
		Report.objects.get_or_create(reporter=viewer, reported_listing_id=listing.id)
		Notification.objects.create(recipient=listing.seller, actor=viewer, notification_type="marketplace", message=f"{viewer.gamer_tag} reported your listing", target_url=f"/marketplace/listing/{listing.id}/")
		messages.success(request, "Thanks. The listing has been reported.")
	return redirect("listing_detail", listing_id=listing.id)


@login_required
def contact_seller(request, listing_id):
	listing = get_object_or_404(Listing, id=listing_id)
	if listing.seller.user_id == request.user.id:
		return redirect("listing_detail", listing_id=listing.id)
	Notification.objects.get_or_create(recipient=listing.seller, actor=getattr(request.user, "gamer_profile", None), notification_type="marketplace", message=f"Someone contacted you about {listing.title}", target_url=f"/marketplace/listing/{listing.id}/")
	return redirect("conversation_start", gamer_tag=listing.seller.gamer_tag)


@login_required
def my_listings(request):
	page = Paginator(Listing.objects.filter(seller__user=request.user), 12).get_page(request.GET.get("page"))
	return render(request, "marketplace/listing_list.html", {"page": page, "mine": True})


@login_required
def saved_listings(request):
	page = Paginator(Listing.objects.filter(saves__user__user=request.user), 12).get_page(request.GET.get("page"))
	return render(request, "marketplace/listing_list.html", {"page": page, "saved": True})

# Create your views here.
