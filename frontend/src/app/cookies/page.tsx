import type { Metadata } from "next";
import { LegalPage, LegalSection, LegalTable } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "The strictly necessary cookies and local storage GGz uses.",
};

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Cookie Policy">
      <LegalSection title="Overview">
        <p>
          GGz uses only <strong>strictly necessary</strong> cookies and localStorage items. We do
          not use analytics cookies, marketing cookies, or any tracking technologies.
        </p>
      </LegalSection>

      <LegalSection title="Strictly Necessary (Always Active)">
        <LegalTable
          head={["Name / Key", "Type", "Purpose", "Duration"]}
          rows={[
            [
              "sessionid",
              "Cookie (HttpOnly, Secure, SameSite=Lax)",
              "Django session authentication",
              "Session / 2 weeks (configurable)",
            ],
            [
              "csrftoken",
              "Cookie (HttpOnly, Secure, SameSite=Lax)",
              "CSRF protection for form submissions",
              "1 year",
            ],
            ["ggz-theme", "localStorage", "User theme preference (light/dark)", "Until cleared by user"],
            [
              "ggz-cookie-consent",
              "localStorage",
              "Records cookie banner acceptance",
              "Until cleared by user",
            ],
            [
              "ggz-companion-history",
              "localStorage",
              "GGz Companion chat history (user-initiated)",
              "Up to 10 entries, until cleared",
            ],
          ]}
        />
      </LegalSection>

      <LegalSection title="External Resources (Not Cookies, But Load Third-Party Content)">
        <p>
          The following external resources are loaded on specific pages. They may set their own
          cookies or process IP addresses per their own policies:
        </p>
        <ul>
          <li>
            <strong>Google Fonts</strong> (fonts.googleapis.com, fonts.gstatic.com) — loaded on
            all pages for the Inter font. Google&apos;s privacy policy applies.
          </li>
          <li>
            <strong>Google Maps JavaScript API</strong> (maps.googleapis.com) — loaded only on
            map/radar pages when API key is configured. Google&apos;s privacy policy applies.
          </li>
          <li>
            <strong>OpenStreetMap Nominatim</strong> (nominatim.openstreetmap.org) — used for
            geocoding on map pages. OSM Foundation privacy policy applies.
          </li>
          <li>
            <strong>Supabase Storage</strong> (*.supabase.co) — used for media uploads when
            S3-compatible storage is configured. Supabase privacy policy applies.
          </li>
          <li>
            <strong>Discord CDN</strong> (cdn.discordapp.com) — used for Discord-linked avatar
            images. Discord privacy policy applies.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="No Analytics / Marketing Cookies">
        <p>
          GGz does <strong>not</strong> use:
        </p>
        <ul>
          <li>Google Analytics / GA4 / gtag</li>
          <li>Google Tag Manager (GTM)</li>
          <li>Facebook/Meta Pixel</li>
          <li>Mixpanel, Amplitude, Plausible, Matomo, or any analytics platform</li>
          <li>Advertising/tracking pixels</li>
          <li>Third-party tracking cookies</li>
        </ul>
        <p>
          If analytics are added in the future, this policy will be updated and consent will be
          obtained where required.
        </p>
      </LegalSection>

      <LegalSection title="Managing Cookies">
        <ul>
          <li>
            Essential cookies cannot be disabled without breaking core functionality (login, CSRF
            protection, session).
          </li>
          <li>
            localStorage items (theme, cookie consent, companion history) can be cleared via
            browser dev tools or by using the &quot;Clear data&quot; option in browser settings.
          </li>
          <li>
            The cookie consent banner stores your acceptance in{" "}
            <code>ggz-cookie-consent</code> localStorage.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions: <a href="mailto:privacy@ggz.example">privacy@ggz.example</a> —{" "}
          <strong>
            placeholder; must be replaced with a verified operational contact before public
            launch
          </strong>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
