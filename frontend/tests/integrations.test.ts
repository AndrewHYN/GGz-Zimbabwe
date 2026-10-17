import {
  vi,
  beforeAll,
  afterAll,
  beforeEach,
  it,
  expect,
  describe,
} from "vitest";
import sharp from "sharp";
const mocks = vi.hoisted(() => ({
  mail: vi.fn().mockResolvedValue({}),
  put: vi.fn().mockResolvedValue({}),
}));
vi.mock("nodemailer", () => ({
  createTransport: () => ({ sendMail: mocks.mail }),
}));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = mocks.put;
  },
  PutObjectCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
}));
import { uploadImage } from "../src/lib/server/storage";
import { liveStreams } from "../src/lib/server/twitch";
import { migrate } from "../src/lib/server/schema";
import { database, insert } from "../src/lib/server/db";
import { handle } from "../src/lib/server/handler";
process.env.GGZ_LOCAL_DATABASE = "memory://";
process.env.BETTER_AUTH_SECRET =
  "integration-only-secret-with-more-than-32-characters";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.SMTP_URL = "smtp://test.invalid";
process.env.EMAIL_FROM = "GGz <support@test.invalid>";
process.env.GOOGLE_CLIENT_ID = "test-google-id";
process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
const request = (path: string, body: Record<string, unknown>) =>
  handle(
    new Request("http://localhost:3000/api/auth/" + path, {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
beforeAll(migrate);
afterAll(async () => {
  vi.unstubAllGlobals();
  await (await database()).destroy();
});
beforeEach(() => {
  mocks.put.mockClear();
  mocks.mail.mockClear();
});
describe("External integrations without real charges or messages", () => {
  it("issues a one-use password recovery token through the configured mail adapter", async () => {
    expect(
      (
        await request("register", {
          username: "recovery_user",
          gamer_tag: "RecoveryUser",
          email: "recovery@test.invalid",
          password1: "Original-password-123",
          password2: "Original-password-123",
        })
      ).status,
    ).toBe(200);
    const start = await request("password-reset", {
      email: "recovery@test.invalid",
    });
    expect(start.status, await start.clone().text()).toBe(200);
    expect(mocks.mail).toHaveBeenCalledOnce();
    const mail = mocks.mail.mock.calls[0][0];
    expect(mail.to).toBe("recovery@test.invalid");
    const url = mail.text.match(/https?:\/\/\S+/)[0];
    const redirect = await handle(new Request(url));
    expect(redirect.status).toBe(302);
    const location = redirect.headers.get("location")!;
    const token = new URL(location, "http://localhost:3000").searchParams.get(
      "token",
    );
    expect(token).toBeTruthy();
    const reset = await request("password-reset/confirm", {
      token,
      new_password1: "Changed-password-123",
      new_password2: "Changed-password-123",
    });
    expect(reset.status, await reset.clone().text()).toBe(200);
    expect(
      (
        await request("login", {
          username: "recovery_user",
          password: "Original-password-123",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request("login", {
          username: "recovery_user",
          password: "Changed-password-123",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request("password-reset/confirm", {
          token,
          new_password1: "Another-password-123",
          new_password2: "Another-password-123",
        })
      ).status,
    ).not.toBe(200);
  });
  it("builds the correct OAuth callback without exposing secrets to the browser", async () => {
    const response = await request("sign-in/social", {
      provider: "google",
      callbackURL: "/dashboard",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    const data = await response.json();
    const url = new URL(data.url);
    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/callback/google",
    );
    expect(data.url).not.toContain("test-google-secret");
  });
  it("decodes and re-encodes images before writing only to the configured bucket", async () => {
    process.env.AWS_S3_ENDPOINT_URL = "https://storage.test.invalid";
    process.env.AWS_ACCESS_KEY_ID = "test-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
    process.env.AWS_STORAGE_BUCKET_NAME = "ggz-test";
    process.env.MEDIA_PUBLIC_URL = "https://media.test.invalid/ggz";
    const png = await sharp({
      create: { width: 40, height: 30, channels: 3, background: "#f59e0b" },
    })
      .png()
      .toBuffer();
    const result = await uploadImage(
      new File([new Uint8Array(png)], "photo.png", { type: "image/png" }),
      "test-user",
    );
    expect(result).toMatch(
      /^https:\/\/media.test.invalid\/ggz\/uploads\/test-user\/.+\.webp$/,
    );
    const command = mocks.put.mock.calls[0][0];
    expect(command.input.Bucket).toBe("ggz-test");
    expect(command.input.ContentType).toBe("image/webp");
    expect((await sharp(command.input.Body).metadata()).format).toBe("webp");
    await expect(
      uploadImage(
        new File(["<svg>"], "fake.png", { type: "image/png" }),
        "test-user",
      ),
    ).rejects.toThrow("Only PNG");
    const truncated = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    await expect(
      uploadImage(new File([truncated], "bad.png"), "test-user"),
    ).rejects.toThrow("damaged");
    expect(mocks.put).toHaveBeenCalledOnce();
  });
  it("maps IGDB games to Twitch categories and retries an expired token only once", async () => {
    process.env.TWITCH_CLIENT_ID = "test-twitch-client";
    process.env.TWITCH_CLIENT_SECRET = "test-twitch-secret";
    const g = await insert("game", { name: "Test Category", igdb_id: 42 });
    let tokens = 0,
      streams = 0;
    const fetcher = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("oauth2/token")) {
        tokens++;
        return Response.json({
          access_token: "test-access-token",
          expires_in: 3600,
        });
      }
      if (url.includes("/games?")) {
        expect(url).toContain("igdb_id=42");
        return Response.json({
          data: [{ id: "900", igdb_id: "42", name: "Test Category" }],
        });
      }
      if (url.includes("/streams?")) {
        expect(url).toContain("game_id=900");
        streams++;
        if (streams === 1) return new Response("expired", { status: 401 });
        return Response.json({
          data: [
            {
              id: "s1",
              user_id: "u1",
              user_login: "test_streamer",
              user_name: "Test",
              game_id: "900",
              game_name: "Test Category",
              title: "Playing",
              viewer_count: 12,
              language: "en",
              thumbnail_url:
                "https://static-cdn.jtvnw.net/test-{width}-{height}.jpg",
              started_at: "2026-01-01T00:00:00Z",
            },
          ],
        });
      }
      throw Error("Unexpected upstream");
    });
    vi.stubGlobal("fetch", fetcher);
    const result = await liveStreams(
      new URLSearchParams({ game: String(g.id) }),
    );
    expect(result.available).toBe(true);
    expect(result.streams[0].ggz_game_id).toBe(g.id);
    expect(result.streams[0].thumbnail_url).toContain("640-360");
    expect(tokens).toBe(2);
    expect(streams).toBe(2);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 500 })),
    );
    expect((await liveStreams(new URLSearchParams())).available).toBe(false);
    vi.unstubAllGlobals();
  });
});
