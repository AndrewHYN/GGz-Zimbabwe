"""Discord OAuth2 + current-user API helpers used by the Connect Discord flow.

This module keeps every Discord URL and HTTP request in one place so views and
templates never talk to Discord directly. It only implements the user OAuth
identity flow (authorize -> token -> /users/@me) with the minimal ``identify``
scope. It does not store tokens and does not implement bot/guild integration.
"""

import json
import logging
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)

DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
DISCORD_API_BASE = "https://discord.com/api/v10"
DISCORD_CDN_BASE = "https://cdn.discordapp.com"
DISCORD_DEFAULT_AVATAR_EXT = "png"
REQUEST_TIMEOUT = 20
OAUTH_SCOPE = "identify"


class DiscordOAuthError(Exception):
	"""Raised when a Discord OAuth/API exchange fails in a handled way."""


def _request_json(url, payload=None, headers=None, method="POST"):
	request = Request(
		url,
		data=None if payload is None else urlencode(payload).encode("utf-8"),
		headers=headers or {},
		method=method,
	)
	try:
		with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
			content = response.read().decode("utf-8")
			return json.loads(content) if content else {}
	except HTTPError as error:
		body = error.read().decode("utf-8", errors="replace")
		logger.error("Discord HTTP %s from %s: %s", error.code, url, body[:300])
		raise DiscordOAuthError("Discord returned an error response.")
	except (URLError, TimeoutError, ValueError):
		logger.exception("Discord request failed for %s", url)
		raise DiscordOAuthError("Discord could not be reached. Please try again.")


def is_configured():
	return bool(settings.DISCORD_CLIENT_ID and settings.DISCORD_CLIENT_SECRET)


def build_authorize_url(state, redirect_uri=None):
	"""Build the Discord authorize URL for a fresh Connect Discord attempt."""
	if not is_configured():
		raise DiscordOAuthError("Discord connection is not configured.")
	params = {
		"client_id": settings.DISCORD_CLIENT_ID,
		"response_type": "code",
		"scope": OAUTH_SCOPE,
		"state": state,
		"redirect_uri": redirect_uri or settings.DISCORD_REDIRECT_URI,
		"prompt": "consent",
	}
	return f"{DISCORD_AUTHORIZE_URL}?{urlencode(params)}"


def exchange_code(code, redirect_uri=None):
	"""Exchange an authorization code for a Discord access token.

	The returned access token is used immediately for /users/@me and is never
	persisted, per the Connect Discord design decision (simple identity display).
	"""
	if not is_configured():
		raise DiscordOAuthError("Discord connection is not configured.")
	token_response = _request_json(
		DISCORD_TOKEN_URL,
		payload={
			"grant_type": "authorization_code",
			"code": code,
			"client_id": settings.DISCORD_CLIENT_ID,
			"client_secret": settings.DISCORD_CLIENT_SECRET,
			"redirect_uri": redirect_uri or settings.DISCORD_REDIRECT_URI,
		},
		headers={"Content-Type": "application/x-www-form-urlencoded"},
		method="POST",
	)
	if "access_token" not in token_response:
		logger.error("Discord token exchange returned no access_token: %s", str(token_response)[:300])
		raise DiscordOAuthError("Discord did not authorize the connection. Please try again.")
	return token_response


def fetch_current_user(access_token):
	"""Fetch the current Discord user identity using a bearer token."""
	user = _request_json(
		f"{DISCORD_API_BASE}/users/@me",
		payload=None,
		headers={"Authorization": f"Bearer {access_token}"},
		method="GET",
	)
	if not user or not user.get("id"):
		logger.error("Discord /users/@me returned an unexpected payload: %s", str(user)[:300])
		raise DiscordOAuthError("Discord could not confirm your identity.")
	return user


def build_avatar_url(user):
	"""Build a Discord CDN avatar URL for a user, falling back to the default avatar."""
	user_id = str(user.get("id") or "")
	avatar_hash = user.get("avatar")
	if not user_id or not avatar_hash:
		return None
	extension = "gif" if avatar_hash.startswith("a_") else DISCORD_DEFAULT_AVATAR_EXT
	return f"{DISCORD_CDN_BASE}/avatars/{user_id}/{avatar_hash}.{extension}?size=128"