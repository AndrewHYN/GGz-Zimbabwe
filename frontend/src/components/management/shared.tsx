"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiFetch, apiErrorMessage } from "@/lib/api";
export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    apiFetch<T>(path)
      .then((d) => {
        if (active) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (active)
          setError(
            apiErrorMessage(e, "We couldn’t load this page. Please try again."),
          );
      });
    return () => {
      active = false;
    };
  }, [path, version]);
  return { data, error, refresh: () => setVersion((v) => v + 1) };
}
export function PageShell({
  title,
  eyebrow = "Your local gaming scene",
  children,
  error,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <p className="ggz-eyebrow">{eyebrow}</p>
      <h1 className="mb-7 mt-2 text-3xl font-extrabold sm:text-4xl">{title}</h1>
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-400/30 p-4 text-red-300"
        >
          {error}{" "}
          <Link href="/auth/login" className="underline">
            Sign in
          </Link>
        </div>
      )}
      {children}
    </div>
  );
}
export interface Field {
  name: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  min?: number;
  max?: number;
}
export function EditorForm({
  fields,
  values = {},
  submit = "Save changes",
  save,
}: {
  fields: Field[];
  values?: Record<string, string | number | boolean | undefined>;
  submit?: string;
  save: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice("");
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      unknown
    >;
    for (const f of fields) {
      if (f.type === "checkbox") data[f.name] = data[f.name] === "on";
      if (f.type === "datetime-local" && data[f.name])
        data[f.name] = new Date(String(data[f.name])).toISOString();
    }
    try {
      await save(data);
      setNotice("Saved successfully.");
    } catch (error) {
      setNotice(apiErrorMessage(error, "Update failed. Please try again."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={send} className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <label
          key={f.name}
          className={f.type === "textarea" ? "sm:col-span-2" : ""}
        >
          {f.label}
          {f.options ? (
            <select
              name={f.name}
              defaultValue={String(values[f.name] ?? "")}
              required={f.required ?? true}
            >
              {f.options.map((o) => (
                <option value={o.value} key={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === "textarea" ? (
            <textarea
              name={f.name}
              defaultValue={String(values[f.name] ?? "")}
              maxLength={3000}
              rows={4}
              required={f.required ?? true}
            />
          ) : (
            <input
              name={f.name}
              type={f.type ?? "text"}
              required={f.type === "checkbox" ? false : (f.required ?? true)}
              defaultValue={
                f.type === "checkbox" ? undefined : String(values[f.name] ?? "")
              }
              defaultChecked={
                f.type === "checkbox" ? Boolean(values[f.name]) : undefined
              }
              min={f.min}
              max={f.max}
              step={f.type === "number" ? "any" : undefined}
              maxLength={f.type === "number" ? undefined : 1000}
            />
          )}
        </label>
      ))}
      <button disabled={busy} className="ggz-primary sm:col-span-2">
        {busy ? "Saving…" : submit}
      </button>
      {notice && (
        <p role="status" className="text-sm sm:col-span-2">
          {notice}
        </p>
      )}
    </form>
  );
}
export function ActionButton({
  path,
  body = {},
  children,
  refresh,
  destructive = false,
}: {
  path: string;
  body?: Record<string, unknown>;
  children: React.ReactNode;
  refresh: () => void;
  destructive?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <button
        disabled={busy}
        className={
          destructive
            ? "rounded-xl border border-red-400/40 px-4 py-2 text-red-300"
            : "ggz-primary"
        }
        onClick={async () => {
          if (destructive && !window.confirm("Confirm this action?")) return;
          setBusy(true);
          setError("");
          try {
            await apiFetch(path, {
              method: "POST",
              body: JSON.stringify(body),
            });
            refresh();
          } catch (e) {
            setError(apiErrorMessage(e, "Action failed."));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Updating…" : children}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
export const options = (items: string[]) =>
  items.map((value) => ({ value, label: value }));
export const orgFields: Field[] = [
  { name: "name", label: "Organization name" },
  { name: "description", label: "About your organization", type: "textarea" },
  {
    name: "organization_type",
    label: "Type",
    options: options(["Community", "Organization", "Brand", "Venue", "Team"]),
  },
  { name: "city", label: "City", required: false },
  { name: "website", label: "Website", type: "url", required: false },
];
export const venueFields: Field[] = [
  { name: "name", label: "Venue name" },
  { name: "description", label: "About this venue", type: "textarea" },
  { name: "city", label: "City" },
  { name: "address", label: "Street address" },
  {
    name: "category",
    label: "Type",
    options: options([
      "Gaming Hub",
      "Esports Arena",
      "LAN Centre",
      "Gaming Café",
      "PC Shop",
      "Developer Studio",
      "Tech Business",
      "Gaming Club",
    ]),
  },
  { name: "latitude", label: "Latitude", type: "number", min: -90, max: 90 },
  {
    name: "longitude",
    label: "Longitude",
    type: "number",
    min: -180,
    max: 180,
  },
  { name: "phone", label: "Contact phone", required: false },
  { name: "opening_hours", label: "Opening hours", required: false },
  { name: "website", label: "Website", type: "url", required: false },
  {
    name: "public_visible",
    label: "Show this venue and its coordinates publicly",
    type: "checkbox",
  },
];
