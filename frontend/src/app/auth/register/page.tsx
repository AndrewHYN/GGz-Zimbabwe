"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArenaArt } from "@/components/competition/ArenaArt";
import { safeNext } from "@/lib/competition";
import { apiFetch, apiErrorMessage, dispatchAuthChanged } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [gamerTag, setGamerTag] = useState("");
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
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
      await apiFetch("/api/auth/register/", {
        method: "POST",
        body: JSON.stringify({
          username,
          email,
          gamer_tag: gamerTag,
          password1,
          password2,
        }),
      });
      dispatchAuthChanged();
      router.push(
        safeNext(new URLSearchParams(window.location.search).get("next")),
      );
      router.refresh();
    } catch (error) {
      setError(
        apiErrorMessage(error, "Registration failed. Please try again."),
      );
      setLoading(false);
    }
  };

  return (
    <div className="arena-container auth-stage">
      <div className="auth-art">
        <p className="eyebrow">YOUR NEXT MATCH STARTS HERE</p>
        <ArenaArt />
        <h2>
          Good games.
          <br />
          Great people.
        </h2>
        <p>Join the local scene. Find your next competition.</p>
      </div>
      <div className="auth-panel">
        <h1 className="text-2xl font-bold text-center mb-6">
          Create your GGz account
        </h1>

        {error && (
          <div
            role="alert"
            className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-[var(--radius-lg)] p-3 mb-4"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium mb-1"
            >
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

          <div>
            <label
              htmlFor="gamerTag"
              className="block text-sm font-medium mb-1"
            >
              Gamer Tag
            </label>
            <input
              id="gamerTag"
              type="text"
              value={gamerTag}
              onChange={(e) => setGamerTag(e.target.value)}
              required
              autoComplete="nickname"
              className="w-full px-3 py-2 bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-lg)] text-sm focus:outline-none focus:ring-2 focus:ring-ggz-accent"
            />
          </div>

          <div>
            <label
              htmlFor="password1"
              className="block text-sm font-medium mb-1"
            >
              Password (at least 12 characters)
            </label>
            <input
              id="password1"
              type="password"
              value={password1}
              onChange={(e) => setPassword1(e.target.value)}
              required
              autoComplete="new-password"
              minLength={12}
              className="w-full px-3 py-2 bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-lg)] text-sm focus:outline-none focus:ring-2 focus:ring-ggz-accent"
            />
          </div>

          <div>
            <label
              htmlFor="password2"
              className="block text-sm font-medium mb-1"
            >
              Confirm Password
            </label>
            <input
              id="password2"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
              autoComplete="new-password"
              minLength={12}
              className="w-full px-3 py-2 bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-lg)] text-sm focus:outline-none focus:ring-2 focus:ring-ggz-accent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-ggz-accent text-black font-semibold rounded-[var(--radius-lg)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-ggz-muted mt-6">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            onClick={(e) => {
              const next = new URLSearchParams(window.location.search).get(
                "next",
              );
              if (next) {
                e.preventDefault();
                router.push(
                  "/auth/login/?next=" + encodeURIComponent(safeNext(next)),
                );
              }
            }}
            className="text-ggz-accent hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
