"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, apiErrorMessage, dispatchAuthChanged } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<{ google: boolean; apple: boolean }>({
    google: false,
    apple: false,
  });

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const incoming = new URLSearchParams(window.location.search).get("error");
    if (incoming) {
      setError(incoming);
      window.history.replaceState({}, "", window.location.pathname);
    }
    apiFetch<{ google: boolean; apple: boolean }>("/api/auth/providers/")
      .then(setProviders)
      .catch(() => setProviders({ google: false, apple: false }));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiFetch("/api/auth/login/", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      dispatchAuthChanged();
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setError(apiErrorMessage(error, "Something went wrong. Please try again."));
      setLoading(false);
    }
  };

  const hasProviders = providers.google || providers.apple;

  return (
    <div className="max-w-[1536px] mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Log in to GGz</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-[var(--radius-lg)] p-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-3 py-2 bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-lg)] text-sm focus:outline-none focus:ring-2 focus:ring-ggz-accent"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <Link href="/auth/forgot-password" className="text-xs text-ggz-accent hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-lg)] text-sm focus:outline-none focus:ring-2 focus:ring-ggz-accent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-ggz-accent text-white font-semibold rounded-[var(--radius-lg)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        {hasProviders && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-ggz-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-ggz-bg-1 px-2 text-ggz-muted">or</span>
              </div>
            </div>

            <div className="space-y-3">
              {providers.google && (
                <a
                  href="/accounts/auth/google/start/"
                  className="flex items-center justify-center gap-2 w-full py-2 border border-ggz-border rounded-[var(--radius-lg)] hover:bg-ggz-bg-2 transition-colors text-sm font-medium"
                >
                  Continue with Google
                </a>
              )}
              {providers.apple && (
                <a
                  href="/accounts/auth/apple/start/"
                  className="flex items-center justify-center gap-2 w-full py-2 border border-ggz-border rounded-[var(--radius-lg)] hover:bg-ggz-bg-2 transition-colors text-sm font-medium"
                >
                  Continue with Apple
                </a>
              )}
            </div>
          </>
        )}

        <p className="text-center text-sm text-ggz-muted mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="text-ggz-accent hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
