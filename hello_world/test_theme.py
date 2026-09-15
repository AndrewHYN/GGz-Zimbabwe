import base64
import hashlib
import re

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.test import Client, RequestFactory, TestCase
from django.template.loader import render_to_string
from django.urls import reverse

RE_INLINE_SCRIPT = re.compile(r"<script>(.*?)</script>", re.S)


class ThemeToggleContractTests(TestCase):

	def _base_html(self):
		request = RequestFactory().get("/")
		request.user = AnonymousUser()
		return render_to_string(
			"base.html",
			{},
			request=request,
		)

	def test_no_fouc_theme_init_script_runs_in_head(self):
		html = self._base_html()
		self.assertIn("document.documentElement.dataset.theme", html)
		self.assertIn("prefers-color-scheme: light", html)
		self.assertIn("localStorage.getItem(\"ggz-theme\")", html)
		head = html.split("</head>")[0]
		self.assertIn("<script>\n(function () {", head)

	def test_exactly_one_inline_script_allowed_by_csp_hash(self):
		html = self._base_html()
		matches = RE_INLINE_SCRIPT.findall(html)
		self.assertEqual(len(matches), 1)
		for match in matches:
			digest = base64.b64encode(hashlib.sha256(match.encode("utf-8")).digest()).decode()
			self.assertIn(f"'sha256-{digest}'", settings.CONTENT_SECURITY_POLICY)

	def test_csp_keeps_script_sources_strict(self):
		policy = settings.CONTENT_SECURITY_POLICY
		self.assertIn("script-src", policy)
		script_source = policy.split("script-src ")[1].split(";")[0]
		self.assertNotIn("'unsafe-inline'", script_source)
		self.assertNotIn("'unsafe-eval'", script_source)
		# style-src may have 'unsafe-inline' for template inline styles; that's allowed

	def test_theme_toggle_renders_in_nav_tools_with_both_icons(self):
		html = self._base_html()
		toolbar = html.split("class=\"nav-tools\"")[1].split("class=\"site-shell\"")[0]
		self.assertIn("data-theme-toggle", toolbar)
		self.assertIn("class=\"theme-icon-day\"", toolbar)
		self.assertIn("class=\"theme-icon-night\"", toolbar)


class LegalPagesTests(TestCase):
	"""Contract tests for legal pages — no placeholder contacts rendered as operational."""

	def setUp(self):
		self.client = Client()

	def _assert_placeholder_contacts_marked(self, html):
		"""Ensure placeholder emails are visibly marked as placeholders."""
		for email in ("privacy@ggz.example", "legal@ggz.example"):
			if email in html:
				idx = html.index(email)
				window = html[max(0, idx-100):idx+100].lower()
				self.assertIn("placeholder", window, f"Email {email} appears without 'placeholder' marker nearby")

	def test_privacy_page_loads_and_links(self):
		url = reverse("privacy")
		resp = self.client.get(url)
		self.assertEqual(resp.status_code, 200)
		html = resp.content.decode()
		self.assertIn("Privacy Policy", html)
		self.assertIn("Data Protection Compliance Checklist", html)
		self.assertIn("placeholder", html)  # contacts are marked as placeholders
		self._assert_placeholder_contacts_marked(html)

	def test_cookie_page_loads_and_has_table(self):
		url = reverse("cookie_policy")
		resp = self.client.get(url)
		self.assertEqual(resp.status_code, 200)
		html = resp.content.decode()
		self.assertIn("Cookie Policy", html)
		self.assertIn("Strictly Necessary", html)
		self.assertIn("sessionid", html)
		self.assertIn("csrftoken", html)
		self.assertIn("ggz-theme", html)
		self.assertIn("No Analytics", html)
		self._assert_placeholder_contacts_marked(html)

	def test_refund_page_loads_and_distinguishes_current_vs_future(self):
		url = reverse("refund_policy")
		resp = self.client.get(url)
		self.assertEqual(resp.status_code, 200)
		html = resp.content.decode()
		self.assertIn("Refund", html)
		self.assertIn("Current Status", html)
		self.assertIn("does not process any paid transactions", html)
		self.assertIn("Future Paid Services", html)
		self.assertIn("no blanket", html.lower())
		self.assertIn("all sales final", html.lower())  # present in context of "no blanket 'all sales final'"
		self._assert_placeholder_contacts_marked(html)

	def test_terms_page_loads_and_has_launch_blockers(self):
		url = reverse("terms")
		resp = self.client.get(url)
		self.assertEqual(resp.status_code, 200)
		html = resp.content.decode()
		self.assertIn("Terms of Service", html)
		self.assertIn("Operating Entity", html)
		self.assertIn("Launch blocker", html)
		self.assertIn("Governing Law", html)
		self.assertIn("Launch blocker", html)
		self._assert_placeholder_contacts_marked(html)

	def test_footer_contains_all_legal_links(self):
		url = reverse("index")
		resp = self.client.get(url)
		self.assertEqual(resp.status_code, 200)
		html = resp.content.decode()
		self.assertIn('href="' + reverse("privacy") + '"', html)
		self.assertIn('href="' + reverse("cookie_policy") + '"', html)
		self.assertIn('href="' + reverse("refund_policy") + '"', html)
		self.assertIn('href="' + reverse("terms") + '"', html)

	def test_no_operational_placeholder_emails_in_legal_pages(self):
		"""Placeholder emails must be visibly marked, not rendered as real contacts."""
		for name in ("privacy", "cookie_policy", "refund_policy", "terms"):
			url = reverse(name)
			resp = self.client.get(url)
			html = resp.content.decode()
			self._assert_placeholder_contacts_marked(html)