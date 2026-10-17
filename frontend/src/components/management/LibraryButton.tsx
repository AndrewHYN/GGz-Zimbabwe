"use client";
import { useState } from "react";
import { apiFetch, apiErrorMessage } from "@/lib/api";
export function LibraryButton({
  gameId,
  inLibrary,
}: {
  gameId: number;
  inLibrary: boolean;
}) {
  const [added, setAdded] = useState(inLibrary);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <button
        className="ggz-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await apiFetch<{ in_library: boolean }>(
              `/api/games/${gameId}/library`,
              { method: "POST", body: "{}" },
            );
            setAdded(r.in_library);
          } catch (e) {
            setError(apiErrorMessage(e, "Please try again."));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Updating…"
          : added
            ? "Remove from my games"
            : "Add to my games"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
