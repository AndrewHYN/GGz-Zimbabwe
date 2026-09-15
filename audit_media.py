import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hello_world.settings')
django.setup()

from accounts.models import GamerProfile
from games.models import Game
from tournaments.models import Tournament
from events.models import Event, Organization
from marketplace.models import Listing, ListingImage
from teams.models import Team

print('=== GamerProfile ===')
for p in GamerProfile.objects.all():
    print(f'{p.gamer_tag}: avatar={p.avatar.name if p.avatar else "EMPTY"}, cover={p.cover.name if p.cover else "EMPTY"}')

print()
print('=== Game ===')
for g in Game.objects.all():
    print(f'{g.name}: cover_art_url="{g.cover_art_url}", trailer_url="{g.trailer_url}"')

print()
print('=== Tournament ===')
for t in Tournament.objects.all():
    print(f'{t.name}: banner={t.banner.name if t.banner else "EMPTY"}')

print()
print('=== Event ===')
for e in Event.objects.all():
    print(f'{e.name}: banner={e.banner.name if e.banner else "EMPTY"}')

print()
print('=== Organization ===')
for o in Organization.objects.all():
    print(f'{o.name}: logo={o.logo.name if o.logo else "EMPTY"}')

print()
print('=== Listing ===')
for l in Listing.objects.all():
    print(f'{l.title}: images={l.images.count()}')
    for img in l.images.all():
        print(f'  image={img.image.name}')

print()
print('=== Team ===')
for t in Team.objects.all():
    print(f'{t.name}: logo={t.logo.name if t.logo else "EMPTY"}, banner={t.banner.name if t.banner else "EMPTY"}')