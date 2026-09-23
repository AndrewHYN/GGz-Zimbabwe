"use client";

import { use, useState } from "react";
import Link from "next/link";
import { apiFetch, apiErrorMessage } from "@/lib/api";

interface ResetPasswordPageProps {
  params: Promise<{ uidb64: string; token: string }>;
}

export default function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { uidb64, token } = use(params);
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password1 !== password2) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await apiFetch("/api/auth/password-reset/confirm/", {
        method: "POST",
        body: JSON.stringify({
          uidb64,
          token,
          new_password1: password1,
          new_password2: password2,
        }),
      });
      setDone(true);
    } catch (error) {
      setError(apiErrorMessage(error, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1536px] mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Choose a new password</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-[var(--radius-lg)] p-3 mb-4">
            {error}
          </div>
        )}

        {done ? (
          <div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-[var(--radius-lg)] p-3 mb-4">
              Your password has been reset. You can now sign in.
            </div>
            <p className="text-center text-sm text-ggz-muted">
              <Link href="/auth/login" className="text-ggz-accent hover:underline">
                Log in with your new password
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new_password1" className="block text-sm font-medium mb-1">
                New password
              </label>
              <input
                id="new_password1"
                type="password"
                value={password1}
                onChange={(e) => setPassword1(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-3 py-2 bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-lg)] text-sm focus:outline-none focus:ring-2 focus:ring-ggz-accent"
              />
            </div>

            <div>
              <label htmlFor="new_password2" className="block text-sm font-medium mb-1">
                Confirm new password
              </label>
              <input
                id="new_password2"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-3 py-2 bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-lg)] text-sm focus:outline-none focus:ring-2 focus:ring-ggz-accent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-ggz-accent text-white font-semibold rounded-[var(--radius-lg)] hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? "Saving..." : "Set new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
