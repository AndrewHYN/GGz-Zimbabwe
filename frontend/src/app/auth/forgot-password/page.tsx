"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, apiErrorMessage } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiFetch("/api/auth/password-reset/", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (error) {
      setError(apiErrorMessage(error, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1536px] mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Reset your password</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-[var(--radius-lg)] p-3 mb-4">
            {error}
          </div>
        )}

        {sent ? (
          <div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-[var(--radius-lg)] p-3 mb-4">
              If that account exists, a password reset email has been sent.
            </div>
            <p className="text-sm text-ggz-muted">
              Check your inbox for a link from GGz. The link expires automatically for your
              security.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2 bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-lg)] text-sm focus:outline-none focus:ring-2 focus:ring-ggz-accent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-ggz-accent text-white font-semibold rounded-[var(--radius-lg)] hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-ggz-muted mt-6">
          Remembered it?{" "}
          <Link href="/auth/login" className="text-ggz-accent hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
