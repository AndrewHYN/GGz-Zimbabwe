"use client";
import { useEffect, useState } from "react";
import { apiFetch, apiErrorMessage } from "@/lib/api";
export function ProfileEditor() {
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<{
    bio: string;
    location: string;
    platform: string;
    availability: string;
    location_public: boolean;
  } | null>(null);
  useEffect(() => {
    apiFetch<NonNullable<typeof profile>>("/api/profiles/edit")
      .then(setProfile)
      .catch(() =>
        setNotice("Your profile could not be loaded. Please refresh."),
      );
  }, []);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    const form = new FormData(e.currentTarget);
    try {
      await apiFetch("/api/profiles/edit", {
        method: "POST",
        body: JSON.stringify({
          ...Object.fromEntries(form),
          location_public: form.get("location_public") === "on",
        }),
      });
      setNotice("Profile updated.");
    } catch (error) {
      setNotice(apiErrorMessage(error, "Profile could not be updated."));
    } finally {
      setBusy(false);
    }
  }
  if (!profile)
    return (
      <p className="mt-6 text-sm" role="status">
        {notice || "Loading profile settings…"}
      </p>
    );
  return (
    <section className="ggz-editor mt-6">
      <p className="ggz-eyebrow">Make it yours</p>
      <h2 className="mt-2 text-xl font-bold">Edit your player profile</h2>
      <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          Bio
          <textarea
            name="bio"
            defaultValue={profile.bio}
            rows={3}
            maxLength={1000}
            placeholder="What do you play? When are you online?"
          />
        </label>
        <label>
          Location
          <input
            name="location"
            defaultValue={profile.location}
            maxLength={100}
            placeholder="Harare"
          />
        </label>
        <label>
          Platform
          <select name="platform" defaultValue={profile.platform}>
            {["PC", "PlayStation", "Xbox", "Nintendo", "Mobile"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Availability
          <select name="availability" defaultValue={profile.availability}>
            {["Available", "Sometimes", "Busy"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3">
          <input
            name="location_public"
            defaultChecked={profile.location_public}
            type="checkbox"
            className="!w-5"
          />
          Show my location publicly
        </label>
        <button disabled={busy} className="ggz-primary sm:col-span-2">
          {busy ? "Saving…" : "Save profile"}
        </button>
        {notice && (
          <p role="status" className="sm:col-span-2 text-sm">
            {notice}
          </p>
        )}
      </form>
    </section>
  );
}
