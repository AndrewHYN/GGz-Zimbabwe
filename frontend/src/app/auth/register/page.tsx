"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [gamerTag, setGamerTag] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/accounts/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username,
          email,
          gamer_tag: gamerTag,
          password,
          password_confirm: confirmPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.detail || data?.message || "Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1536px] mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Create your GGz account</h1>

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
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-lg)] text-sm focus:outline-none focus:ring-2 focus:ring-ggz-accent"
            />
          </div>

          <div>
            <label htmlFor="gamerTag" className="block text-sm font-medium mb-1">
              Gamer Tag
            </label>
            <input
              id="gamerTag"
              type="text"
              value={gamerTag}
              onChange={(e) => setGamerTag(e.target.value)}
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

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-lg)] text-sm focus:outline-none focus:ring-2 focus:ring-ggz-accent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-ggz-accent text-white font-semibold rounded-[var(--radius-lg)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-ggz-muted mt-6">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-ggz-accent hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
