"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

async function fetchWithTimeout(url: string, options: RequestInit, ms = 20000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await fetchWithTimeout("/api/csrf/", { credentials: "include" });

      const csrfToken = document.cookie
        .split('; ')
        .find((c) => c.startsWith('csrftoken='))
        ?.split('=')[1] || '';

      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);
      formData.append("csrfmiddlewaretoken", csrfToken);

      const res = await fetchWithTimeout("/accounts/login/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        credentials: "include",
        body: formData.toString(),
        redirect: "manual",
      });

      if (res.type === "opaqueredirect" || res.status === 0) {
        router.push("/dashboard");
        return;
      }

      if (res.ok || res.status === 302) {
        router.push("/dashboard");
        return;
      }

      setError("Invalid credentials. Please try again.");
      setLoading(false);
    } catch (error) {
      setError(
        error instanceof DOMException && error.name === "AbortError"
          ? "The server is taking too long to respond. Check your connection and try again."
          : "Something went wrong. Please try again."
      );
      setLoading(false);
    }
  };

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
              className="w-full px-3 py-2 bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-lg)] text-sm focus:outline-none focus:ring-2 focus:ring-ggz-accent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-ggz-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-ggz-bg-1 px-2 text-ggz-muted">or</span>
          </div>
        </div>

        <a
          href="/accounts/auth/google/start/"
          className="flex items-center justify-center gap-2 w-full py-2 border border-ggz-border rounded-[var(--radius-lg)] hover:bg-ggz-bg-2 transition-colors text-sm font-medium"
        >
          Continue with Google
        </a>

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
