from django.db.models import Exists, OuterRef, Q

from .models import Organization, OrganizationLocation


def public_organizations(query=""):
    venues = OrganizationLocation.objects.filter(organization_id=OuterRef("pk"), public_visible=True).exclude(
        verification_status__in=("SUSPENDED", "INACTIVE")
    )
    organizations = Organization.objects.filter(Q(location_public=True) | Exists(venues)).exclude(
        verification_status="Rejected"
    )
    if query:
        organizations = organizations.filter(
            Q(name__icontains=query)
            | Q(description__icontains=query)
            | Q(organization_type__icontains=query)
            | (Q(location_public=True) & (Q(city__icontains=query) | Q(country__icontains=query)))
            | Exists(venues.filter(Q(name__icontains=query) | Q(city__icontains=query) | Q(country__icontains=query)))
        )
    return organizations.order_by("name", "pk")
