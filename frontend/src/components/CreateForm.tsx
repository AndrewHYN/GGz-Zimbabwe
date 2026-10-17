"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, apiErrorMessage } from "@/lib/api";

type Kind = "tournaments" | "events" | "marketplace";
export function CreateForm({ kind }: { kind: Kind }) {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<
    { id: number; name: string; is_owner: boolean }[]
  >([]);
  const [games, setGames] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (kind === "events")
      apiFetch<typeof organizations>("/api/organizations")
        .then((rows) => setOrganizations(rows.filter((o) => o.is_owner)))
        .catch(() => {});
    if (kind === "tournaments")
      apiFetch<typeof games>("/api/games")
        .then(setGames)
        .catch(() => setError("Games could not be loaded. Please refresh."));
  }, [kind]);
  const title =
    kind === "tournaments"
      ? "Host a tournament"
      : kind === "events"
        ? "Bring your people together"
        : "Give your gear a new player";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    for (const field of ["start_date", "registration_deadline"])
      if (data[field])
        data[field] = new Date(String(data[field])).toISOString();
    try {
      if (data.organization_id === "") delete data.organization_id;
      if (data.image instanceof File && data.image.size > 0) {
        const upload = new FormData();
        upload.append("image", data.image);
        const uploaded = await apiFetch<{ url: string }>("/api/uploads", {
          method: "POST",
          body: upload,
        });
        data.image = uploaded.url;
      } else delete data.image;
      const result = await apiFetch<{ id: number; slug?: string }>(
        `/api/${kind}/create`,
        { method: "POST", body: JSON.stringify(data) },
      );
      router.push(
        kind === "tournaments"
          ? `/tournaments/${result.slug}`
          : kind === "events"
            ? `/events/${result.id}`
            : `/marketplace/listing/${result.id}`,
      );
    } catch (error) {
      setError(apiErrorMessage(error, "Please try again."));
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href={`/${kind}`} className="text-sm text-ggz-text-secondary">
        ← Back to {kind}
      </Link>
      <div className="ggz-editor mt-5">
        <p className="ggz-eyebrow">Made for the local scene</p>
        <h1 className="mt-2 text-3xl font-bold">{title}</h1>
        <p className="mb-8 mt-3 text-ggz-text-secondary">
          {kind === "marketplace"
            ? "Keep it honest. Add the condition, a fair price and a safe meeting area."
            : "Start with a draft. Publish when the details are ready."}
        </p>
        <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
          <label className="sm:col-span-2">
            {kind === "marketplace" ? "Listing title" : "Name"}
            <input
              name={kind === "marketplace" ? "title" : "name"}
              required
              maxLength={120}
              placeholder={
                kind === "tournaments"
                  ? "Harare weekend showdown"
                  : kind === "events"
                    ? "Friday game night"
                    : "PlayStation 5 controller"
              }
            />
          </label>
          <label className="sm:col-span-2">
            Description
            <textarea
              name="description"
              required
              maxLength={5000}
              rows={5}
              placeholder="What should players know?"
            />
          </label>
          {kind === "events" && organizations.length > 0 && (
            <label>
              Organizing community
              <select name="organization_id" defaultValue="">
                <option value="">My personal event</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === "tournaments" && (
            <>
              <label>
                Game
                <select name="game" required>
                  <option value="">Choose a game</option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Player limit
                <input
                  name="max_participants"
                  type="number"
                  min={2}
                  max={128}
                  defaultValue={8}
                  required
                />
              </label>
              <label>
                Registration closes
                <input
                  name="registration_deadline"
                  type="datetime-local"
                  required
                />
              </label>
              <label className="sm:col-span-2">
                Rules
                <textarea
                  name="rules"
                  required
                  rows={4}
                  defaultValue="Free entry. Single elimination, 1v1. Be on time, play fairly, and report scores to the organizer."
                />
              </label>
              <label className="sm:col-span-2">
                Prize (optional)
                <input name="prize_description" maxLength={500} />
              </label>
            </>
          )}
          {kind !== "marketplace" && (
            <>
              <label>
                Start date and time
                <input name="start_date" type="datetime-local" required />
              </label>
              <label>
                Play mode
                <select name="mode">
                  <option>Online</option>
                  <option>In Person</option>
                  <option>Hybrid</option>
                </select>
              </label>
              {kind === "events" && (
                <label>
                  Capacity
                  <input
                    name="capacity"
                    type="number"
                    min={1}
                    max={5000}
                    defaultValue={20}
                    required
                  />
                </label>
              )}
              <label>
                Status
                <select name="status">
                  <option value="Draft">Private draft</option>
                  <option value={kind === "tournaments" ? "Open" : "Published"}>
                    Publish now
                  </option>
                </select>
              </label>
            </>
          )}
          {kind === "marketplace" && (
            <>
              <label>
                Category
                <select name="category">
                  {[
                    "Consoles",
                    "Controllers",
                    "Headsets",
                    "Monitors",
                    "Keyboards",
                    "Mice",
                    "Games",
                    "Accessories",
                    "Other",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Condition
                <select name="condition">
                  {["New", "Like New", "Good", "Fair", "Poor"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Photo (PNG, JPEG or WebP, up to 3 MB)
                <input
                  name="image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                />
              </label>
              <label>
                Price (USD)
                <input
                  name="price"
                  type="number"
                  min="0.01"
                  max="100000"
                  step="0.01"
                  required
                />
              </label>
            </>
          )}
          <label className="sm:col-span-2">
            {kind === "marketplace"
              ? "Meeting area"
              : "Location or online platform"}
            <input
              name="location"
              required
              maxLength={200}
              placeholder="Harare / Discord / gaming lounge"
            />
          </label>
          {error && (
            <p role="alert" className="sm:col-span-2 text-red-400">
              {error}
            </p>
          )}
          <button disabled={busy} className="ggz-primary sm:col-span-2">
            {busy
              ? "Saving…"
              : kind === "marketplace"
                ? "Publish listing"
                : "Save event"}
          </button>
        </form>
      </div>
    </div>
  );
}
