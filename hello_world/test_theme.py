import base64
import hashlib
import re

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, TestCase
from django.template.loader import render_to_string

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
		self.assertEqual(len(matches), 2)
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