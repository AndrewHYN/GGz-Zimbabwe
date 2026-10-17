"use client";
import { apiFetch } from "@/lib/api";
import { EditorForm, ActionButton, options } from "./shared";
interface ManagedEvent {
  id: number;
  name: string;
  description?: string | null;
  start_date?: string | null;
  location?: string | null;
  city?: string | null;
  capacity?: number | null;
  mode: string;
  status: string;
}
function localTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function EventManager({
  event,
  refresh,
}: {
  event: ManagedEvent;
  refresh: () => void;
}) {
  return (
    <section className="ggz-editor mt-6">
      <p className="ggz-eyebrow">Organizer desk</p>
      <h2 className="my-3 text-xl font-bold">Manage your event</h2>
      <div className="flex flex-wrap gap-3">
        {event.status === "Draft" && (
          <ActionButton
            path={`/api/events/${event.id}/publish`}
            refresh={refresh}
          >
            Publish event
          </ActionButton>
        )}
        {["Published", "Upcoming"].includes(event.status) && (
          <ActionButton
            path={`/api/events/${event.id}/start`}
            refresh={refresh}
          >
            Start event
          </ActionButton>
        )}
        {event.status === "Live" && (
          <ActionButton
            path={`/api/events/${event.id}/complete`}
            refresh={refresh}
          >
            Complete event
          </ActionButton>
        )}
        {!["Completed", "Cancelled"].includes(event.status) && (
          <ActionButton
            path={`/api/events/${event.id}/cancel`}
            refresh={refresh}
            destructive
          >
            Cancel event
          </ActionButton>
        )}
      </div>
      {!["Completed", "Cancelled"].includes(event.status) && (
        <details className="mt-5">
          <summary className="cursor-pointer font-semibold">
            Request event promotion
          </summary>
          <p className="my-3 text-sm text-ggz-text-secondary">
            For events associated with your organization. Staff review every
            request.
          </p>
          <EditorForm
            fields={[
              {
                name: "campaign_description",
                label: "Campaign description",
                type: "textarea",
              },
            ]}
            submit="Request promotion"
            save={async (body) => {
              await apiFetch(`/api/events/${event.id}/promotion`, {
                method: "POST",
                body: JSON.stringify(body),
              });
            }}
          />
        </details>
      )}
      {["Draft", "Published", "Upcoming"].includes(event.status) && (
        <details className="mt-5">
          <summary className="cursor-pointer font-semibold">
            Edit event details
          </summary>
          <div className="mt-4">
            <EditorForm
              fields={[
                { name: "name", label: "Name" },
                { name: "description", label: "Description", type: "textarea" },
                {
                  name: "start_date",
                  label: "Start time",
                  type: "datetime-local",
                },
                { name: "location", label: "Location" },
                { name: "city", label: "City", required: false },
                {
                  name: "capacity",
                  label: "Capacity",
                  type: "number",
                  min: 1,
                  max: 5000,
                },
                {
                  name: "mode",
                  label: "Mode",
                  options: options(["Online", "In Person", "Hybrid"]),
                },
              ]}
              values={{
                name: event.name,
                description: event.description ?? "",
                start_date: localTime(event.start_date),
                location: event.location ?? "",
                city: event.city ?? "",
                capacity: event.capacity ?? 5000,
                mode: event.mode,
              }}
              save={async (body) => {
                await apiFetch(`/api/events/${event.id}/edit`, {
                  method: "POST",
                  body: JSON.stringify(body),
                });
                refresh();
              }}
            />
          </div>
        </details>
      )}
    </section>
  );
}
