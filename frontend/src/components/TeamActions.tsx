"use client";
import { useState } from "react";
import { apiFetch, apiErrorMessage } from "@/lib/api";
export function TeamActions({
  slug,
  isMember,
  isOwner,
  refresh,
}: {
  slug: string;
  isMember: boolean;
  isOwner: boolean;
  refresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function action() {
    setBusy(true);
    try {
      await apiFetch(`/api/teams/${slug}/${isMember ? "leave" : "join"}`, {
        method: "POST",
        body: "{}",
      });
      refresh();
    } catch (e) {
      setNotice(apiErrorMessage(e, "Please try again."));
    } finally {
      setBusy(false);
    }
  }
  if (isOwner) return null;
  return (
    <div className="my-4">
      <button className="ggz-primary" disabled={busy} onClick={action}>
        {busy ? "Updating…" : isMember ? "Leave team" : "Join team"}
      </button>
      {notice && (
        <p role="status" className="mt-2 text-sm text-ggz-text-secondary">
          {notice}
        </p>
      )}
    </div>
  );
}
