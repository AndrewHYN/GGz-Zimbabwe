import json
import re
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from .models import GamerProfile, SocialIdentity


class AuthApiTestCase(TestCase):
    """Shared isolation: fresh rate-limit cache + per-class REMOTE_ADDR so the
    API tests never consume the legacy HTML auth buckets (login/signup/
    password_reset are keyed by REMOTE_ADDR + time bucket)."""

    REMOTE_ADDR = "198.51.100.7"

    def setUp(self):
        cache.clear()
        self.client = Client(REMOTE_ADDR=self.REMOTE_ADDR)

    def tearDown(self):
        cache.clear()

    def _json(self, response):
        return json.loads(response.content.decode("utf-8"))

    def _post_json(self, url, payload, **extra):
        return self.client.post(
            url,
            data=json.dumps(payload),
            content_type="application/json",
            **extra,
        )

    def _make_user(self, username="apitest", email="apitest@example.com", password="strong-password-123", gamer_tag="ApiTestZW"):
        user = User.objects.create_user(username=username, email=email, password=password)
        GamerProfile.objects.create(user=user, gamer_tag=gamer_tag)
        return user


class LoginApiTests(AuthApiTestCase):
    REMOTE_ADDR = "198.51.100.7"

    def test_login_success_returns_auth_payload_and_session(self):
        self._make_user()
        response = self._post_json(
            reverse("api_auth_login"),
            {"username": "apitest", "password": "strong-password-123"},
        )
        self.assertEqual(response.status_code, 200)
        payload = self._json(response)
        self.assertTrue(payload["ok"])
        self.assertTrue(payload["authenticated"])
        self.assertEqual(payload["user"]["username"], "apitest")
        self.assertEqual(payload["profile"]["gamer_tag"], "ApiTestZW")
        me = self._json(self.client.get(reverse("api_me")))
        self.assertTrue(me["authenticated"])

    def test_login_accepts_form_encoded_payload(self):
        self._make_user()
        response = self.client.post(
            reverse("api_auth_login"),
            {"username": "apitest", "password": "strong-password-123"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(self._json(response)["ok"])

    def test_login_invalid_credentials_return_generic_401(self):
        self._make_user()
        response = self._post_json(
            reverse("api_auth_login"),
            {"username": "apitest", "password": "wrong-password"},
        )
        self.assertEqual(response.status_code, 401)
        payload = self._json(response)
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["error"], "We couldn’t sign you in with those details. Please try again.")
        self.assertNotIn("errors", payload)

    def test_login_inactive_user_returns_same_generic_401(self):
        user = self._make_user()
        user.is_active = False
        user.save(update_fields=["is_active"])
        response = self._post_json(
            reverse("api_auth_login"),
            {"username": "apitest", "password": "strong-password-123"},
        )
        self.assertEqual(response.status_code, 401)
        payload = self._json(response)
        self.assertEqual(payload["error"], "We couldn’t sign you in with those details. Please try again.")

    def test_login_requires_post(self):
        response = self.client.get(reverse("api_auth_login"))
        self.assertEqual(response.status_code, 405)

    def test_login_malformed_json_returns_400(self):
        response = self.client.post(
            reverse("api_auth_login"),
            data="{not-json",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        payload = self._json(response)
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["error"], "Invalid request.")

    def test_login_rate_limited_shares_html_bucket(self):
        self._make_user()
        with patch("accounts.views.time.time", return_value=1741000000.0):
            for _ in range(20):
                response = self._post_json(
                    reverse("api_auth_login"),
                    {"username": "nobody", "password": "wrong"},
                )
                self.assertEqual(response.status_code, 401)
            response = self._post_json(
                reverse("api_auth_login"),
                {"username": "apitest", "password": "strong-password-123"},
            )
        self.assertEqual(response.status_code, 429)
        payload = self._json(response)
        self.assertEqual(payload["error"], "Too many sign-in attempts. Please wait a minute and try again.")


class LogoutApiTests(AuthApiTestCase):
    REMOTE_ADDR = "198.51.100.7"

    def test_logout_is_idempotent_for_anonymous(self):
        response = self.client.post(reverse("api_auth_logout"))
        self.assertEqual(response.status_code, 200)
        payload = self._json(response)
        self.assertTrue(payload["ok"])
        self.assertFalse(payload["authenticated"])

    def test_logout_clears_authenticated_session(self):
        self._make_user()
        self._post_json(
            reverse("api_auth_login"),
            {"username": "apitest", "password": "strong-password-123"},
        )
        response = self.client.post(reverse("api_auth_logout"))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(self._json(response)["authenticated"])
        me = self.client.get(reverse("api_me"))
        self.assertEqual(me.status_code, 401)


class RegisterApiTests(AuthApiTestCase):
    REMOTE_ADDR = "198.51.100.8"

    def test_register_success_creates_user_profile_and_session(self):
        response = self._post_json(
            reverse("api_auth_register"),
            {
                "username": "newapiuser",
                "email": "newapiuser@example.com",
                "gamer_tag": "NewApiUserZW",
                "password1": "strong-password-123",
                "password2": "strong-password-123",
            },
        )
        self.assertEqual(response.status_code, 201)
        payload = self._json(response)
        self.assertTrue(payload["authenticated"])
        self.assertEqual(payload["profile"]["gamer_tag"], "NewApiUserZW")
        user = User.objects.get(username="newapiuser")
        self.assertTrue(user.check_password("strong-password-123"))
        me = self._json(self.client.get(reverse("api_me")))
        self.assertTrue(me["authenticated"])

    def test_register_duplicate_email_returns_field_errors(self):
        self._make_user(username="other", email="taken@example.com", gamer_tag="OtherZW")
        response = self._post_json(
            reverse("api_auth_register"),
            {
                "username": "dupuser",
                "email": "taken@example.com",
                "gamer_tag": "DupUserZW",
                "password1": "strong-password-123",
                "password2": "strong-password-123",
            },
        )
        self.assertEqual(response.status_code, 400)
        payload = self._json(response)
        self.assertFalse(payload["ok"])
        self.assertIn("email", payload["errors"])
        self.assertTrue(any("already in use" in message for message in payload["errors"]["email"]))

    def test_register_invalid_gamer_tag_returns_field_errors(self):
        response = self._post_json(
            reverse("api_auth_register"),
            {
                "username": "taguser",
                "email": "taguser@example.com",
                "gamer_tag": "Bad Tag!",
                "password1": "strong-password-123",
                "password2": "strong-password-123",
            },
        )
        self.assertEqual(response.status_code, 400)
        payload = self._json(response)
        self.assertIn("gamer_tag", payload["errors"])

    def test_register_weak_password_returns_field_errors(self):
        response = self._post_json(
            reverse("api_auth_register"),
            {
                "username": "weakuser",
                "email": "weakuser@example.com",
                "gamer_tag": "WeakUserZW",
                "password1": "short",
                "password2": "short",
            },
        )
        self.assertEqual(response.status_code, 400)
        payload = self._json(response)
        password_fields = [field for field in payload["errors"] if field.startswith("password")]
        self.assertTrue(password_fields)

    def test_register_requires_post(self):
        response = self.client.get(reverse("api_auth_register"))
        self.assertEqual(response.status_code, 405)

    def test_register_rate_limited_shares_html_bucket(self):
        with patch("accounts.views.time.time", return_value=1742000000.0):
            for attempt in range(20):
                response = self._post_json(
                    reverse("api_auth_register"),
                    {"username": f"burst{attempt}"},
                )
                self.assertEqual(response.status_code, 400)
            response = self._post_json(
                reverse("api_auth_register"),
                {
                    "username": "afterburst",
                    "email": "afterburst@example.com",
                    "gamer_tag": "AfterBurstZW",
                    "password1": "strong-password-123",
                    "password2": "strong-password-123",
                },
            )
        self.assertEqual(response.status_code, 429)
        payload = self._json(response)
        self.assertEqual(payload["error"], "Too many accounts created from this location. Please wait and try again.")
        self.assertFalse(User.objects.filter(username="afterburst").exists())


class PasswordResetApiTests(AuthApiTestCase):
    REMOTE_ADDR = "198.51.100.9"

    def setUp(self):
        super().setUp()
        mail.outbox.clear()

    def test_unknown_email_returns_generic_success_and_sends_no_email(self):
        response = self._post_json(reverse("api_auth_password_reset"), {"email": "nobody@example.com"})
        self.assertEqual(response.status_code, 200)
        payload = self._json(response)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["message"], "If that account exists, a password reset email has been sent.")
        self.assertEqual(len(mail.outbox), 0)

    def test_known_email_sends_frontend_reset_link(self):
        self._make_user()
        response = self._post_json(reverse("api_auth_password_reset"), {"email": "apitest@example.com"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        body = mail.outbox[0].body
        match = re.search(r"(\w+://[^/\s]+/auth/reset-password/([^/\s]+)/([^/\s]+)/)", body)
        self.assertIsNotNone(match, f"frontend reset link missing from email body: {body}")
        self.assertTrue(match.group(1).startswith(settings.FRONTEND_URL), match.group(1))
        self.assertTrue(match.group(2))
        self.assertTrue(match.group(3))

    def test_malformed_email_returns_400(self):
        response = self._post_json(reverse("api_auth_password_reset"), {"email": "not-an-email"})
        self.assertEqual(response.status_code, 400)
        payload = self._json(response)
        self.assertIn("email", payload["errors"])

    def test_missing_email_returns_400(self):
        response = self._post_json(reverse("api_auth_password_reset"), {})
        self.assertEqual(response.status_code, 400)
        payload = self._json(response)
        self.assertIn("email", payload["errors"])

    def test_password_reset_rate_limited_shares_html_bucket(self):
        self._make_user()
        with patch("accounts.views.time.time", return_value=1743000000.0):
            for _ in range(5):
                response = self._post_json(reverse("api_auth_password_reset"), {"email": "apitest@example.com"})
                self.assertEqual(response.status_code, 200)
            response = self._post_json(reverse("api_auth_password_reset"), {"email": "apitest@example.com"})
        self.assertEqual(response.status_code, 429)
        payload = self._json(response)
        self.assertEqual(payload["error"], "Too many password reset requests from this location. Please wait and try again.")


class PasswordResetConfirmApiTests(AuthApiTestCase):
    REMOTE_ADDR = "198.51.100.10"

    def _reset_link_parts(self, user):
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        return uidb64, token

    def test_confirm_success_sets_new_password(self):
        user = self._make_user()
        uidb64, token = self._reset_link_parts(user)
        response = self._post_json(
            reverse("api_auth_password_reset_confirm"),
            {"uidb64": uidb64, "token": token, "new_password1": "brand-new-password-456", "new_password2": "brand-new-password-456"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(self._json(response)["ok"])
        user.refresh_from_db()
        self.assertTrue(user.check_password("brand-new-password-456"))
        self.assertFalse(user.check_password("strong-password-123"))

    def test_confirm_invalid_token_returns_400(self):
        user = self._make_user()
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        response = self._post_json(
            reverse("api_auth_password_reset_confirm"),
            {"uidb64": uidb64, "token": "not-a-real-token", "new_password1": "brand-new-password-456", "new_password2": "brand-new-password-456"},
        )
        self.assertEqual(response.status_code, 400)
        payload = self._json(response)
        self.assertEqual(payload["error"], "This reset link is invalid or has expired. Request a new one.")
        user.refresh_from_db()
        self.assertTrue(user.check_password("strong-password-123"))

    def test_confirm_weak_password_returns_field_errors(self):
        user = self._make_user()
        uidb64, token = self._reset_link_parts(user)
        response = self._post_json(
            reverse("api_auth_password_reset_confirm"),
            {"uidb64": uidb64, "token": token, "new_password1": "short", "new_password2": "short"},
        )
        self.assertEqual(response.status_code, 400)
        payload = self._json(response)
        self.assertTrue([field for field in payload["errors"] if field.startswith("new_password")])

    def test_confirm_requires_post(self):
        response = self.client.get(reverse("api_auth_password_reset_confirm"))
        self.assertEqual(response.status_code, 405)

    def test_confirm_rate_limited(self):
        user = self._make_user()
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        with patch("accounts.views.time.time", return_value=1744000000.0):
            for _ in range(20):
                response = self._post_json(
                    reverse("api_auth_password_reset_confirm"),
                    {"uidb64": uidb64, "token": "bad-token", "new_password1": "brand-new-password-456", "new_password2": "brand-new-password-456"},
                )
                self.assertEqual(response.status_code, 400)
            response = self._post_json(
                reverse("api_auth_password_reset_confirm"),
                {"uidb64": uidb64, "token": "bad-token", "new_password1": "brand-new-password-456", "new_password2": "brand-new-password-456"},
            )
        self.assertEqual(response.status_code, 429)


class PasswordChangeApiTests(AuthApiTestCase):
    REMOTE_ADDR = "198.51.100.11"

    def test_password_change_requires_auth(self):
        response = self._post_json(
            reverse("api_auth_password_change"),
            {"old_password": "x", "new_password1": "y", "new_password2": "y"},
        )
        self.assertEqual(response.status_code, 401)
        payload = self._json(response)
        self.assertEqual(payload["error"], "Sign in to change your password.")

    def test_password_change_success_forces_reauth(self):
        user = self._make_user()
        self.client.force_login(user)
        response = self._post_json(
            reverse("api_auth_password_change"),
            {"old_password": "strong-password-123", "new_password1": "brand-new-password-456", "new_password2": "brand-new-password-456"},
        )
        self.assertEqual(response.status_code, 200)
        payload = self._json(response)
        self.assertTrue(payload["reauth_required"])
        user.refresh_from_db()
        self.assertTrue(user.check_password("brand-new-password-456"))
        me = self.client.get(reverse("api_me"))
        self.assertEqual(me.status_code, 401)

    def test_password_change_wrong_old_password_returns_400(self):
        user = self._make_user()
        self.client.force_login(user)
        response = self._post_json(
            reverse("api_auth_password_change"),
            {"old_password": "wrong-old", "new_password1": "brand-new-password-456", "new_password2": "brand-new-password-456"},
        )
        self.assertEqual(response.status_code, 400)
        payload = self._json(response)
        self.assertIn("old_password", payload["errors"])
        user.refresh_from_db()
        self.assertTrue(user.check_password("strong-password-123"))

    def test_password_change_requires_post(self):
        response = self.client.get(reverse("api_auth_password_change"))
        self.assertEqual(response.status_code, 405)


class UnlinkApiTests(AuthApiTestCase):
    REMOTE_ADDR = "198.51.100.12"

    def test_unlink_requires_auth(self):
        response = self.client.post(reverse("api_auth_unlink", kwargs={"provider": "google"}))
        self.assertEqual(response.status_code, 401)

    def test_unlink_unknown_provider_returns_404(self):
        user = self._make_user()
        self.client.force_login(user)
        response = self.client.post(reverse("api_auth_unlink", kwargs={"provider": "steam"}))
        self.assertEqual(response.status_code, 404)

    def test_unlink_not_connected_returns_400(self):
        user = self._make_user()
        self.client.force_login(user)
        response = self.client.post(reverse("api_auth_unlink", kwargs={"provider": "google"}))
        self.assertEqual(response.status_code, 400)
        payload = self._json(response)
        self.assertEqual(payload["error"], "No Google account connected.")

    def test_unlink_success_removes_identity(self):
        user = self._make_user()
        SocialIdentity.objects.create(user=user, provider="google", provider_user_id="g-1", email="apitest@example.com")
        self.client.force_login(user)
        response = self.client.post(reverse("api_auth_unlink", kwargs={"provider": "google"}))
        self.assertEqual(response.status_code, 200)
        payload = self._json(response)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["provider"], "google")
        self.assertFalse(SocialIdentity.objects.filter(user=user, provider="google").exists())

    def test_unlink_last_passwordless_method_is_refused(self):
        user = User.objects.create_user(username="pwlessapi", email="pwlessapi@example.com")
        GamerProfile.objects.create(user=user, gamer_tag="PwlessApiZW")
        SocialIdentity.objects.create(user=user, provider="discord", provider_user_id="d-1", display_name="Only")
        self.client.force_login(user)
        response = self.client.post(reverse("api_auth_unlink", kwargs={"provider": "discord"}))
        self.assertEqual(response.status_code, 400)
        payload = self._json(response)
        self.assertIn("only sign-in method", payload["error"])
        self.assertTrue(SocialIdentity.objects.filter(user=user, provider="discord").exists())


class ProvidersApiTests(AuthApiTestCase):
    REMOTE_ADDR = "198.51.100.13"

    def test_providers_unconfigured_by_default(self):
        response = self.client.get(reverse("api_auth_providers"))
        self.assertEqual(response.status_code, 200)
        payload = self._json(response)
        self.assertFalse(payload["google"])
        self.assertFalse(payload["apple"])

    @override_settings(GOOGLE_CLIENT_ID="g-id", GOOGLE_CLIENT_SECRET="g-secret")
    def test_providers_reports_configured_google(self):
        response = self.client.get(reverse("api_auth_providers"))
        payload = self._json(response)
        self.assertTrue(payload["google"])
        self.assertFalse(payload["apple"])


class CsrfEnforcementTests(AuthApiTestCase):
    REMOTE_ADDR = "198.51.100.14"

    def test_login_post_without_csrf_token_is_rejected(self):
        csrf_client = Client(enforce_csrf_checks=True, REMOTE_ADDR=self.REMOTE_ADDR)
        response = csrf_client.post(
            reverse("api_auth_login"),
            data=json.dumps({"username": "x", "password": "y"}),
            content_type="application/json",
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        self.assertEqual(response.status_code, 403)
        payload = self._json(response)
        self.assertFalse(payload["ok"])

    def test_login_post_with_csrf_token_from_csrf_endpoint_passes(self):
        csrf_client = Client(enforce_csrf_checks=True, REMOTE_ADDR=self.REMOTE_ADDR)
        csrf_response = csrf_client.get(reverse("api_csrf_token"))
        self.assertEqual(csrf_response.status_code, 200)
        token = csrf_client.cookies["csrftoken"].value
        response = csrf_client.post(
            reverse("api_auth_login"),
            data=json.dumps({"username": "nobody", "password": "wrong"}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        self.assertEqual(response.status_code, 401)
        payload = self._json(response)
        self.assertEqual(payload["error"], "We couldn’t sign you in with those details. Please try again.")
