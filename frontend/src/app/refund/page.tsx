import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description: "GGz refund and cancellation terms.",
};

export default function RefundPage() {
  return (
    <LegalPage title="Refund & Cancellation Policy">
      <LegalSection title="Current Status — No Direct Payments Processed">
        <p>
          As of this policy date, <strong>GGz does not process any paid transactions directly</strong>.
          The platform does not collect payment card details, does not integrate with payment
          processors (Stripe, PayPal, crypto, mobile money, etc.), and does not charge fees for
          tournament entries, marketplace listings, or any other platform features.
        </p>
        <p>
          All current GGz features — player profiles, community feed, tournament discovery, event
          RSVPs, team creation, marketplace listings, messaging, and companion search — are
          provided at no cost to users.
        </p>
      </LegalSection>

      <LegalSection title="Marketplace Transactions">
        <p>
          The GGz Marketplace is a peer-to-peer listing service. Transactions (payment,
          delivery, fulfillment) occur <strong>directly between users</strong> outside the GGz
          platform. GGz is not a party to these transactions, does not process payments, and
          does not offer refunds, chargebacks, or purchase protection for marketplace deals.
        </p>
        <p>
          Users are responsible for conducting due diligence, using safe payment methods, and
          resolving disputes directly with the other party. GGz may mediate but is not liable for
          outcomes.
        </p>
      </LegalSection>

      <LegalSection title="Future Paid Services">
        <p>
          If GGz introduces paid features in the future (e.g., paid tournament entries, premium
          subscriptions, promoted listings, marketplace escrow), this policy will be updated{" "}
          <strong>before launch</strong> to reflect:
        </p>
        <ul>
          <li>The specific payment processor(s) and methods used</li>
          <li>Refund eligibility criteria for each paid feature</li>
          <li>Cancellation windows and conditions</li>
          <li>Dispute resolution process</li>
          <li>Any non-refundable fees or exclusions</li>
        </ul>
        <p>
          <strong>
            No blanket &quot;all sales final&quot; or invented exclusions are declared here.
          </strong>{" "}
          Any future refund terms will be based on the actual service contracts and payment
          processor terms in effect at that time.
        </p>
      </LegalSection>

      <LegalSection title="Account Deletion & Data">
        <p>
          Deleting your account is free and permanent. See the{" "}
          <Link href="/privacy">Privacy Policy</Link> and{" "}
          <Link href="/accounts/security/">Account Security</Link> page for data export and
          deletion rights.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about this policy:{" "}
          <a href="mailto:legal@ggz.example">legal@ggz.example</a> (placeholder — replace with
          operational contact before public launch).
        </p>
      </LegalSection>
    </LegalPage>
  );
}
