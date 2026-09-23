"""JSON authentication API consumed by the Next.js frontend.

Django remains the single authentication authority (session cookie + CSRF +
existing password hashers). These endpoints mirror the legacy HTML auth views
so the canonical public site never has to POST to, or scrape, Django-rendered
templates. All responses share one error shape:

    {"ok": false, "error": "<human message>", "errors": {field: [msgs]}}

Rate-limit buckets intentionally reuse the same keys as the legacy HTML views
("login", "signup", "password_reset") so switching surfaces cannot bypass them.
"""

import json
from urllib.parse import urlsplit

from django.conf import settings
from django.contrib.auth import login, logout
from django.contrib.auth.forms import PasswordChangeForm, PasswordResetForm, SetPasswordForm
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.http import JsonResponse
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.views.decorators.http import require_GET, require_POST

from accounts.forms import SignupForm
from accounts.models import GamerProfile, SocialIdentity
from accounts.views import GGZAuthenticationForm, _provider_is_configured, _rate_limit_exceeded

from hello_world.core.api import _serialize_file_field


def _frontend_origin():
    return (getattr(settings, "FRONTEND_URL", "") or "http://localhost:3000").rstrip("/")


def _data(request):
    content_type = request.content_type or ""
    if "application/json" in content_type:
        try:
            payload = json.loads(request.body.decode("utf-8") or "{}")
        except (ValueError, UnicodeDecodeError):
            return None
        return payload if isinstance(payload, dict) else None
    return request.POST.dict()


def _error(message, status=400, errors=None):
    payload = {"ok": False, "error": message}
    if errors:
        payload["errors"] = errors
    return JsonResponse(payload, status=status)


def _form_errors(form):
    return {
        field: [str(message) for message in messages]
        for field, messages in form.errors.items()
    }


def _auth_payload(user):
    try:
        profile = GamerProfile.objects.get(user=user)
        profile_data = {
            "gamer_tag": profile.gamer_tag,
            "avatar": _serialize_file_field(profile.avatar),
        }
    except GamerProfile.DoesNotExist:
        profile_data = {"gamer_tag": None, "avatar": None}
    return {
        "ok": True,
        "authenticated": True,
        "user": {"id": user.id, "username": user.username, "email": user.email},
        "profile": profile_data,
    }


@require_POST
def api_auth_login(request):
    if _rate_limit_exceeded(request, "login", 20):
        return _error("Too many sign-in attempts. Please wait a minute and try again.", 429)
    data = _data(request)
    if data is None:
        return _error("Invalid request.")
    form = GGZAuthenticationForm(request, data=data)
    if form.is_valid():
        user = form.get_user()
        login(request, user)
        request.session.cycle_key()
        return JsonResponse(_auth_payload(user))
    non_field = form.non_field_errors()
    message = (
        str(non_field[0])
        if non_field
        else "We couldn’t sign you in with those details. Please try again."
    )
    return _error(message, 401)


@require_POST
def api_auth_logout(request):
    if request.user.is_authenticated:
        logout(request)
    return JsonResponse({"ok": True, "authenticated": False})


@require_POST
def api_auth_register(request):
    if _rate_limit_exceeded(request, "signup", 20, 600):
        return _error("Too many accounts created from this location. Please wait and try again.", 429)
    data = _data(request)
    if data is None:
        return _error("Invalid request.")
    form = SignupForm(data)
    if not form.is_valid():
        return _error("Please fix the errors below.", 400, _form_errors(form))
    user = form.save()
    login(request, user)
    request.session.cycle_key()
    return JsonResponse(_auth_payload(user), status=201)


@require_POST
def api_auth_password_reset(request):
    if _rate_limit_exceeded(request, "password_reset", 5, 600):
        return _error("Too many password reset requests from this location. Please wait and try again.", 429)
    data = _data(request)
    if data is None:
        return _error("Invalid request.")
    form = PasswordResetForm(data)
    if not form.is_valid():
        # Only field-level problems (missing/malformed email) surface here;
        # unknown addresses still return the generic success below.
        return _error("Please enter a valid email address.", 400, _form_errors(form))
    frontend_parts = urlsplit(_frontend_origin())
    form.save(
        subject_template_name="registration/password_reset_subject.txt",
        email_template_name="registration/password_reset_email_frontend.html",
        from_email=settings.DEFAULT_FROM_EMAIL,
        use_https=frontend_parts.scheme == "https",
        domain_override=frontend_parts.netloc or None,
    )
    return JsonResponse({
        "ok": True,
        "message": "If that account exists, a password reset email has been sent.",
    })


@require_POST
def api_auth_password_reset_confirm(request):
    if _rate_limit_exceeded(request, "password_reset_confirm", 20, 600):
        return _error("Too many attempts. Please wait and try again.", 429)
    data = _data(request)
    if data is None:
        return _error("Invalid request.")
    uidb64 = str(data.get("uidb64") or data.get("uid") or "")
    token = str(data.get("token") or "")
    user = None
    if uidb64 and token:
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None
    if user is None or not default_token_generator.check_token(user, token):
        return _error("This reset link is invalid or has expired. Request a new one.")
    form = SetPasswordForm(user, data)
    if not form.is_valid():
        return _error("Please fix the errors below.", 400, _form_errors(form))
    form.save()
    return JsonResponse({
        "ok": True,
        "message": "Your password has been reset. You can now sign in.",
    })


@require_POST
def api_auth_password_change(request):
    if not request.user.is_authenticated:
        return _error("Sign in to change your password.", 401)
    data = _data(request)
    if data is None:
        return _error("Invalid request.")
    form = PasswordChangeForm(request.user, data)
    if not form.is_valid():
        return _error("Please fix the errors below.", 400, _form_errors(form))
    form.save()
    # Match the legacy HTML flow: changing a password ends the current
    # session and forces a fresh sign-in.
    logout(request)
    return JsonResponse({
        "ok": True,
        "reauth_required": True,
        "message": "Your password was changed. Please sign in again.",
    })


@require_POST
def api_auth_unlink(request, provider):
    if not request.user.is_authenticated:
        return _error("Sign in to manage connected accounts.", 401)
    if provider not in {"google", "apple", "discord"}:
        return _error("Unknown provider.", 404)
    identity = SocialIdentity.objects.filter(user=request.user, provider=provider).first()
    if not identity:
        return _error(f"No {provider.title()} account connected.")
    if (
        request.user.social_identities.exclude(provider=provider).count() == 0
        and not request.user.has_usable_password()
    ):
        return _error(
            f"You cannot unlink your only sign-in method for {provider.title()}. "
            "Add a password or another provider first."
        )
    identity.delete()
    return JsonResponse({"ok": True, "provider": provider})


@require_GET
def api_auth_providers(request):
    return JsonResponse({
        "google": _provider_is_configured("google"),
        "apple": _provider_is_configured("apple"),
    })
