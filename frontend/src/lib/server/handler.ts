import { z } from "zod";
import { auth } from "./auth";
import {
  ensureProfile,
  HttpError,
  mutatePlatform,
  readPlatform,
  check,
} from "./platform";
import { list } from "./db";

export async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname
    .split("/")
    .filter(Boolean)
    .slice(1)
    .map(decodeURIComponent);
  const writing = !["GET", "HEAD"].includes(request.method);
  try {
    if (writing) {
      const origin = request.headers.get("origin");
      const expectedOrigin = process.env.BETTER_AUTH_URL
        ? new URL(process.env.BETTER_AUTH_URL).origin
        : url.origin;
      check(
        origin === expectedOrigin,
        "Request origin could not be verified.",
        403,
      );
      check(
        Number(request.headers.get("content-length") || 0) <
          (path[0] === "uploads" ? 4 * 1024 * 1024 : 100000),
        "Request is too large.",
        413,
      );
    }
    if (path[0] === "csrf")
      return Response.json(
        { ok: true },
        {
          headers: {
            "Cache-Control": "no-store",
            "Set-Cookie": "csrftoken=same-origin; Path=/; SameSite=Lax",
          },
        },
      );
    if (path[0] === "health") {
      await list("game");
      return Response.json({ ok: true, framework: "nextjs" });
    }
    if (path[0] === "live") {
      const { liveStreams } = await import("./twitch");
      return Response.json(await liveStreams(url.searchParams));
    }
    const authentication = await auth();
    if (path[0] === "auth") {
      if (path[1] === "providers")
        return Response.json({
          google: Boolean(
            process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
          ),
          apple: false,
        });
      if (writing) {
        const data = await request.json().catch(() => ({}));
        let endpoint = "";
        let body: Record<string, unknown> = {};
        if (path[1] === "login") {
          endpoint = data.username?.includes("@")
            ? "sign-in/email"
            : "sign-in/username";
          body = {
            [endpoint.endsWith("email") ? "email" : "username"]: data.username,
            password: data.password,
          };
        } else if (path[1] === "register") {
          check(data.password1 === data.password2, "Passwords do not match.");
          const tag = z
            .string()
            .trim()
            .regex(
              /^[a-zA-Z0-9_-]{3,40}$/,
              "Gamer tag must contain 3–40 letters, numbers, underscores or dashes.",
            )
            .parse(data.gamer_tag || data.username);
          check(
            !(await list("profile")).some(
              (p) => p.gamer_tag.toLowerCase() === tag.toLowerCase(),
            ),
            "That gamer tag is already taken.",
            409,
          );
          endpoint = "sign-up/email";
          body = {
            name: tag,
            username: data.username,
            email: data.email,
            password: data.password1,
          };
        } else if (path[1] === "unlink") {
          endpoint = "unlink-account";
          body = { providerId: path[2] };
        } else if (path[1] === "logout") {
          endpoint = "sign-out";
        } else if (path[1] === "password-change") {
          check(
            data.new_password1 === data.new_password2,
            "Passwords do not match.",
          );
          endpoint = "change-password";
          body = {
            currentPassword: data.old_password || data.current_password,
            newPassword: data.new_password1 || data.new_password,
            revokeOtherSessions: true,
          };
        } else if (path[1] === "password-reset" && path[2] === "confirm") {
          endpoint = "reset-password";
          body = { token: data.token, newPassword: data.new_password1 };
        } else if (path[1] === "password-reset") {
          check(
            process.env.SMTP_URL,
            "Password recovery is temporarily unavailable. Please contact GGz support.",
            503,
          );
          endpoint = "request-password-reset";
          body = {
            email: data.email,
            redirectTo: `${url.origin}/auth/reset-password/email/token`,
          };
        }
        if (endpoint) {
          const headers = new Headers(request.headers);
          headers.delete("content-length");
          return authentication.handler(
            new Request(new URL(`/api/auth/${endpoint}`, url), {
              method: "POST",
              headers,
              body: JSON.stringify(body),
            }),
          );
        }
      }
      return authentication.handler(request);
    }
    const session = await authentication.api.getSession({
      headers: request.headers,
    });
    const viewer = session ? await ensureProfile(session.user) : undefined;
    if (path[0] === "security" && path[1] === "overview") {
      check(session && viewer, "Please log in.", 401);
      const accounts = await authentication.api.listUserAccounts({
        headers: request.headers,
      });
      return Response.json(
        {
          username: viewer.username,
          email: session.user.email,
          presence: {
            show_online_status: viewer.show_online_status,
            show_last_seen: viewer.show_last_seen,
          },
          providers: [
            {
              provider: "google",
              name: "Google",
              connected: accounts.some((a) => a.providerId === "google"),
              display_name: session.user.name,
              available: Boolean(
                process.env.GOOGLE_CLIENT_ID &&
                  process.env.GOOGLE_CLIENT_SECRET,
              ),
            },
          ],
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (path[0] === "me") {
      check(session && viewer, "Please log in.", 401);
      return Response.json(
        {
          authenticated: true,
          user: {
            id: session.user.id,
            username: viewer.username,
            email: session.user.email,
          },
          profile: { gamer_tag: viewer.gamer_tag, avatar: viewer.avatar },
          unread_count: (await list("notification")).filter(
            (n) => n.recipient === viewer.id && !n.is_read,
          ).length,
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (path[0] === "uploads" && writing) {
      check(session, "Please log in.", 401);
      const form = await request.formData();
      const file = form.get("image");
      check(file instanceof File, "Choose an image.");
      const { uploadImage } = await import("./storage");
      return Response.json({ url: await uploadImage(file, session.user.id) });
    }
    let body: Record<string, unknown> = {};
    if (writing) {
      check(viewer, "Please log in.", 401);
      body = request.headers.get("content-type")?.includes("application/json")
        ? await request.json()
        : Object.fromEntries(await request.formData());
      // Uploaded files use the storage endpoint; never silently discard an attachment.
      check(
        !Object.values(body).some((v) => v instanceof File && v.size > 0),
        "Upload the image first, then submit its URL.",
      );
    }
    const result = writing
      ? await mutatePlatform(path, body, viewer!)
      : await readPlatform(path, url.searchParams, viewer);
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        { error: error.issues.map((i) => i.message).join(" ") },
        { status: 400 },
      );
    if (error instanceof HttpError)
      return Response.json({ error: error.message }, { status: error.status });
    console.error(
      "GGz request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return Response.json(
      { error: "GGz is temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }
}
