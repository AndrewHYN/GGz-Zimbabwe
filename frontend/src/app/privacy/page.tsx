import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection, LegalTable } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How GGz collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <LegalSection title="1. Information We Collect">
        <p>
          We collect information you provide directly to us when you create an account, set up
          your profile, post content, interact with other players, or contact us for support.
          This includes:
        </p>
        <ul>
          <li>Account information: username, email address, password (hashed)</li>
          <li>
            Profile information: gamer tag, bio, location (optional), platform preferences,
            gaming interests
          </li>
          <li>
            Content you create: posts, comments, tournament registrations, event RSVPs,
            marketplace listings
          </li>
          <li>Social connections: follows, friend requests, blocks, team memberships</li>
          <li>Communication data: messages with other players, message requests</li>
          <li>
            Technical data: IP address, browser type, device information, access times (for
            security and service operation)
          </li>
          <li>
            Location data: coarse city-level location if you opt in (used for nearby events and
            player discovery)
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. How We Use Your Information">
        <ul>
          <li>Provide and improve the GGz platform</li>
          <li>Enable player discovery, matchmaking, and community features</li>
          <li>Facilitate tournaments, events, and team play</li>
          <li>Send service-related communications (security alerts, account changes)</li>
          <li>Prevent abuse, fraud, and enforce our Terms of Service</li>
          <li>Comply with legal obligations</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Information Sharing">
        <p>We do not sell your personal information. We may share data only in these cases:</p>
        <ul>
          <li>With other players: profile info you make public, posts, tournament participation</li>
          <li>
            With service providers: hosting, email delivery, analytics (under data processing
            agreements)
          </li>
          <li>Legal requirements: when required by law or to protect rights and safety</li>
          <li>Business transfers: in case of merger/acquisition (with notice)</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Your Rights">
        <p>You can exercise the following rights through your account settings:</p>
        <ul>
          <li>
            Access and download your data (
            <Link href="/accounts/security/">Account Security → Your Data</Link>)
          </li>
          <li>Rectify inaccurate information (edit profile)</li>
          <li>
            Delete your account and all associated data (
            <Link href="/accounts/security/">Account Security → Delete Account</Link>)
          </li>
          <li>Restrict processing (adjust privacy settings, block users)</li>
          <li>Object to processing (unsubscribe from non-essential emails)</li>
          <li>Data portability (JSON export available in Account Security)</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Data Retention">
        <p>
          We retain your data while your account is active. After deletion, we purge personal
          data within 30 days, except where longer retention is required by law (e.g.,
          transaction records for marketplace sales).
        </p>
      </LegalSection>

      <LegalSection title="6. Security">
        <p>
          We implement appropriate technical and organizational measures: HTTPS everywhere,
          hashed passwords, CSRF protection, Content Security Policy, rate limiting, and regular
          security reviews.
        </p>
      </LegalSection>

      <LegalSection title="7. International Transfers">
        <p>
          GGz uses third-party hosting and infrastructure providers. The locations of data
          processing may vary by provider. If you access GGz from outside Zimbabwe, your data
          will be transferred to the jurisdictions where our providers operate.
        </p>
        <p>
          <strong>Launch blocker:</strong> Cross-border transfer safeguards (standard contractual
          clauses, adequacy decisions, or other appropriate mechanisms) require legal
          verification before public launch. This is flagged as a pre-launch requirement.
        </p>
      </LegalSection>

      <LegalSection title="8. Children's Privacy">
        <p>
          GGz is not directed at children under 13. We do not knowingly collect personal
          information from children under 13. If you believe we have collected such data, contact
          us to have it removed.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to This Policy">
        <p>
          We may update this policy. Material changes will be notified via email or in-app
          notice. Continued use constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection title="11. Data Protection Compliance Checklist (Pre-Launch)">
        <p>
          The following items require verification by the data controller / legal counsel before
          public launch. This checklist is based on the current Zimbabwe data protection
          framework (Cyber and Data Protection Act [Chapter 12:07]) and general data protection
          principles.
        </p>
        <LegalTable
          head={["Requirement", "Status", "Notes"]}
          rows={[
            [
              "Data controller identification",
              "Needs owner/legal determination",
              "Legal entity operating GGz must be identified",
            ],
            [
              "POTRAZ registration / licensing applicability",
              "Needs owner/legal determination",
              "Depends on business structure and processing scope",
            ],
            [
              "Data Protection Officer (DPO) appointment",
              "Needs owner/legal determination",
              "Required if core activities involve large-scale systematic monitoring or sensitive data",
            ],
            [
              "Records of Processing Activities (ROPA)",
              "Partially implemented",
              "Technical logging exists; formal ROPA document needed",
            ],
            [
              "Processor agreements (DPA) with all subprocessors",
              "In progress",
              "Hosting, email, Supabase, Google Maps, OSM providers",
            ],
            [
              "Cross-border transfer safeguards",
              "In progress",
              "Standard contractual clauses or adequacy — legal review required",
            ],
            [
              "Children's data protection (under 13)",
              "Implemented in policy",
              "Age gate at signup; no under-13 targeting",
            ],
            [
              "Data retention schedules",
              "Partially implemented",
              "Account deletion purges within 30 days; marketplace records may require longer",
            ],
            [
              "Data subject rights (access, rectification, erasure, portability, restriction, objection)",
              "Technically implemented",
              "Export JSON, account deletion, profile edit, block users",
            ],
            [
              "Security incident handling & breach notification",
              "Needs formal procedure",
              "Incident response plan and POTRAZ notification timeline required",
            ],
            [
              "Privacy by design / default in new features",
              "Ongoing",
              "Engineering practice; formal DPIA process for high-risk features",
            ],
          ]}
        />
        <p>
          <strong>Note:</strong> &quot;Needs owner/legal determination&quot; means the codebase
          cannot establish this requirement — the business owner or legal counsel must decide
          based on GGz&apos;s actual structure, size, and processing activities.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          Questions about this policy or your data:{" "}
          <a href="mailto:privacy@ggz.example">privacy@ggz.example</a> —{" "}
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
