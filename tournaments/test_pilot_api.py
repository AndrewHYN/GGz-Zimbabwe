import json
from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import OperationalError
from django.test import Client, TestCase
from django.utils import timezone
from accounts.models import GamerProfile
from games.models import Game
from .models import Tournament, TournamentRegistration


class PilotApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = GamerProfile.objects.create(user=User.objects.create_user('host'), gamer_tag='Host')
        self.other = GamerProfile.objects.create(user=User.objects.create_user('other'), gamer_tag='Other')
        self.game = Game.objects.create(name='Pilot game')
        now = timezone.now()
        self.data = {'name': 'Friday cup', 'game': self.game.id, 'description': 'A local pilot',
                     'mode': 'offline', 'location': 'Public cafe', 'max_participants': 16,
                     'start_date': (now+timedelta(days=2)).isoformat(),
                     'registration_deadline': (now+timedelta(days=1)).isoformat(),
                     'rules': 'PC, best of three. Check in 15 minutes early. Contact the referee in person.'}
        self.client.force_login(self.owner.user)

    def post(self, path, data=None, client=None):
        return (client or self.client).post(path, json.dumps(data or {}), content_type='application/json')

    def create(self):
        response = self.post('/api/competition/create/', self.data)
        self.assertEqual(response.status_code, 201, response.content)
        return Tournament.objects.get(slug=response.json()['slug'])

    def action(self, t, action):
        return self.post(f'/api/competition/{t.slug}/actions/{action}/')

    def test_creation_is_private_free_and_1v1(self):
        t=self.create()
        self.assertEqual((t.status,t.entry_type,t.format), ('Draft','Free','1v1'))
        self.assertEqual(Client().get(f'/api/tournaments/{t.slug}/').status_code,404)
        self.assertEqual(Client().get(f'/tournaments/{t.slug}/').status_code,404)
        self.assertEqual(Client().get('/api/tournaments/').json(),[])
        self.assertEqual(self.client.get(f'/api/tournaments/{t.slug}/').status_code,200)

    def test_client_cannot_override_price_status_or_owner(self):
        self.data.update(entry_type='Paid',status='Live',format='5v5',organizer=self.other.id)
        t=self.create()
        self.assertEqual((t.organizer_id,t.status,t.entry_type,t.format),(self.owner.id,'Draft','Free','1v1'))

    def test_creation_and_game_choice_require_login(self):
        self.assertEqual(self.post('/api/competition/create/',self.data,Client()).status_code,401)
        self.assertEqual(self.post('/api/competition/game/',{'game':self.game.id},Client()).status_code,401)

    def test_invalid_dates_venue_rules_and_capacity_are_rejected(self):
        for changes in [{'max_participants':33},{'max_participants':1},{'location':''},{'rules':''},
                        {'start_date':timezone.now().isoformat()},
                        {'registration_deadline':(timezone.now()+timedelta(days=3)).isoformat()}]:
            with self.subTest(changes=changes):
                cache.clear()
                response=self.post('/api/competition/create/',{**self.data,**changes})
                self.assertEqual(response.status_code,400)
                self.assertFalse(Tournament.objects.exists())

    def test_csrf_protects_event_creation(self):
        c=Client(enforce_csrf_checks=True);c.force_login(self.owner.user)
        self.assertEqual(self.post('/api/competition/create/',self.data,c).status_code,403)

    def test_my_events_are_scoped_to_owner(self):
        t=self.create();self.client.force_login(self.other.user)
        self.assertEqual(self.client.get('/api/competition/me/').json()['organized'],[])
        self.assertEqual(self.action(t,'open').status_code,404)

    def test_choose_game_enables_eligibility(self):
        t=self.create();self.action(t,'open');self.client.force_login(self.other.user)
        self.assertFalse(self.client.get(f'/api/tournaments/{t.slug}/').json()['eligible'])
        self.assertEqual(self.post('/api/competition/game/',{'game':self.game.id}).status_code,200)
        self.assertTrue(self.client.get(f'/api/tournaments/{t.slug}/').json()['eligible'])

    def test_published_event_is_visible_and_cancelled_event_is_not_listed(self):
        t=self.create();self.assertEqual(self.action(t,'open').status_code,200)
        self.assertEqual(len(Client().get('/api/tournaments/').json()),1)
        self.action(t,'cancel');self.assertEqual(Client().get('/api/tournaments/').json(),[])

    def test_start_requires_two_players_and_published_event(self):
        t=self.create();self.assertEqual(self.action(t,'bracket').status_code,409)
        self.action(t,'open');self.assertEqual(self.action(t,'bracket').status_code,409)
        self.assertFalse(t.matches.exists())

    def live_event(self, players=2):
        t=self.create();self.action(t,'open')
        for i in range(players):
            p=GamerProfile.objects.create(user=User.objects.create_user(f'p{i}'),gamer_tag=f'P{i}')
            p.games.add(self.game);TournamentRegistration.objects.create(tournament=t,player=p)
        self.assertEqual(self.action(t,'bracket').status_code,200)
        t.refresh_from_db();self.assertEqual(t.status,'Live')
        return t

    def test_bracket_is_not_duplicated_and_registration_stays_locked(self):
        t=self.live_event();count=t.matches.count()
        self.assertEqual(self.action(t,'bracket').status_code,409)
        self.assertEqual(self.action(t,'open').status_code,409)
        self.assertEqual(t.matches.count(),count)

    def test_full_result_flow_and_duplicate_award_protection(self):
        t=self.live_event(4)
        for match in t.matches.filter(round=1):
            path=f'/api/competition/{t.slug}/matches/{match.id}/result/'
            self.assertEqual(self.post(path,{'winner':match.player_one_id,'score':'2-0'}).status_code,200)
            self.assertEqual(self.post(path,{'winner':match.player_one_id,'score':'2-0'}).status_code,400)
        final=t.matches.get(round=2)
        self.assertIsNotNone(final.player_one_id);self.assertIsNotNone(final.player_two_id)
        path=f'/api/competition/{t.slug}/matches/{final.id}/result/'
        self.assertEqual(self.post(path,{'winner':final.player_one_id,'score':'2-1'}).status_code,200)
        t.refresh_from_db();self.assertEqual(t.status,'Completed')
        winner=GamerProfile.objects.get(pk=final.player_one_id);self.assertEqual(winner.tournament_wins,1)
        self.assertEqual(self.post(path,{'winner':final.player_one_id,'score':'2-1'}).status_code,409)
        winner.refresh_from_db();self.assertEqual(winner.tournament_wins,1)

    def test_result_rejects_outsider_wrong_event_and_wrong_owner(self):
        t=self.live_event();match=t.matches.first();path=f'/api/competition/{t.slug}/matches/{match.id}/result/'
        self.assertEqual(self.post(path,{'winner':self.other.id,'score':'2-0'}).status_code,400)
        self.client.force_login(self.other.user)
        self.assertEqual(self.post(path,{'winner':match.player_one_id,'score':'2-0'}).status_code,404)

    def test_cancelled_event_cannot_accept_results(self):
        t=self.live_event();match=t.matches.first();self.action(t,'cancel')
        self.assertEqual(self.post(f'/api/competition/{t.slug}/matches/{match.id}/result/',{'winner':match.player_one_id,'score':'2-0'}).status_code,409)

    def test_readiness_fails_closed_without_exposing_traceback(self):
        with patch('django.db.migrations.executor.MigrationExecutor.__init__',side_effect=OperationalError('private connection details')):
            response=self.client.get('/ready/')
            self.assertEqual(response.status_code,503)
            self.assertNotIn('private',response.content.decode())
        self.assertEqual(self.client.get('/ready/').status_code,200)
