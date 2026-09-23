import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of GGz.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <LegalSection title="Operating Entity">
        <p>
          <strong>Launch blocker:</strong> The legal entity operating GGz (company name,
          registration number, registered address, directors) must be disclosed here before
          public launch. This information requires business/legal determination and cannot be
          inferred from the codebase.
        </p>
        <p>Until completed, the operating entity is not disclosed.</p>
      </LegalSection>

      <LegalSection title="1. Acceptance of Terms">
        <p>
          By creating an account or using GGz, you agree to these Terms. If you do not agree, do
          not use the service.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility">
        <p>
          You must be at least 13 years old. If you are under 18, you represent that you have
          parental consent. You are responsible for all activity under your account.
        </p>
      </LegalSection>

      <LegalSection title="3. Your Account">
        <ul>
          <li>Provide accurate information and keep it updated</li>
          <li>Choose a unique gamer tag (no impersonation, hate speech, or trademarks)</li>
          <li>Keep your password secure; notify us if compromised</li>
          <li>One account per person; no bots or automated scripts</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Community Standards">
        <p>GGz is a competitive gaming community. You agree not to:</p>
        <ul>
          <li>Harass, threaten, or doxx other players</li>
          <li>Post hate speech, extremist content, or illegal material</li>
          <li>Cheat, exploit bugs, or use unauthorized software in tournaments</li>
          <li>Spam, scam, or manipulate marketplace listings</li>
          <li>Share private information without consent</li>
          <li>Impersonate GGz staff or other players</li>
        </ul>
        <p>Violations may result in warnings, temporary restrictions, or permanent bans.</p>
      </LegalSection>

      <LegalSection title="5. Content You Post">
        <p>
          You retain ownership of your posts, comments, and listings. By posting, you grant GGz
          a worldwide, non-exclusive, royalty-free license to display, distribute, and promote
          your content on the platform.
        </p>
        <p>
          You represent you have the right to post the content and it does not infringe
          intellectual property.
        </p>
      </LegalSection>

      <LegalSection title="6. Tournaments &amp; Events">
        <ul>
          <li>Follow tournament rules and organizer instructions</li>
          <li>No match-fixing, collusion, or unsportsmanlike conduct</li>
          <li>Prizes are as described by organizers; GGz is not liable for prize fulfillment</li>
          <li>Results are final unless a clear rules violation is proven</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Marketplace">
        <ul>
          <li>Listings must be accurate, legal, and gaming-related</li>
          <li>Transactions are between users; GGz is not a party</li>
          <li>No prohibited items (accounts, cheats, illegal goods)</li>
          <li>Disputes should be resolved between parties; GGz may mediate but is not liable</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Intellectual Property">
        <p>
          GGz branding, code, and design are our property. Game trademarks belong to their
          owners. You may not copy, modify, or distribute GGz assets without permission.
        </p>
      </LegalSection>

      <LegalSection title="9. Disclaimers">
        <p>
          GGz is provided &quot;as is&quot; without warranties of any kind. We do not guarantee
          uninterrupted, error-free, or secure access. We are not liable for indirect,
          incidental, or consequential damages.
        </p>
      </LegalSection>

      <LegalSection title="10. Termination">
        <p>
          You may delete your account anytime. We may suspend or terminate accounts for Terms
          violations with or without notice.
        </p>
      </LegalSection>

      <LegalSection title="11. Governing Law">
        <p>
          <strong>Launch blocker:</strong> Governing law and dispute resolution jurisdiction
          require legal determination based on the operating entity&apos;s incorporation and
          target markets. This section must be completed by legal counsel before public launch.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          Questions: <a href="mailto:legal@ggz.example">legal@ggz.example</a> —{" "}
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
