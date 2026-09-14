from django.conf import settings


class SecurityHeadersMiddleware:
    """Apply baseline response hardening headers when enabled in settings."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if settings.SECURITY_HEADERS_ENABLED:
            response.setdefault("Cross-Origin-Opener-Policy", "same-origin")
            response.setdefault(
                "Permissions-Policy",
                "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), "
                "magnetometer=(), gyroscope=(), accelerometer=()",
            )
            response.setdefault("Content-Security-Policy", settings.CONTENT_SECURITY_POLICY)
        return response