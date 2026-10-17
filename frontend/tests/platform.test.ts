import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { migrate } from "../src/lib/server/schema";
import { database, insert, list, type RecordData } from "../src/lib/server/db";
import {
  ensureProfile,
  readPlatform,
  mutatePlatform,
} from "../src/lib/server/platform";
import { handle } from "../src/lib/server/handler";
process.env.GGZ_LOCAL_DATABASE = "memory://";
process.env.BETTER_AUTH_SECRET =
  "test-only-secret-with-more-than-thirty-two-characters";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
let owner: RecordData, alice: RecordData, bob: RecordData, game: RecordData;
const query = new URLSearchParams();
const read = (path: string, viewer?: RecordData) =>
  readPlatform(path.split("/"), query, viewer) as Promise<RecordData>;
const write = (path: string, body: Record<string, unknown>, viewer = owner) =>
  mutatePlatform(path.split("/"), body, viewer) as Promise<RecordData>;
beforeAll(async () => {
  await migrate();
  owner = await ensureProfile({
    id: "owner",
    name: "Owner",
    email: "owner@test.invalid",
  });
  alice = await ensureProfile({
    id: "alice",
    name: "Alice",
    email: "alice@test.invalid",
  });
  bob = await ensureProfile({
    id: "bob",
    name: "Bob",
    email: "bob@test.invalid",
  });
  game = await insert("game", {
    name: "Test Fighter",
    genre: "Fighting",
    platform: "PC",
    description: "A test game",
  });
});
afterAll(async () => {
  await (await database()).destroy();
});
describe("Native Next.js platform", () => {
  it("keeps profiles private and respects location consent", async () => {
    const p = await read("profiles/detail/Alice");
    expect(p.user_id).toBeUndefined();
    expect(p.location).toBe("Zimbabwe");
    expect(p.blocked).toBeUndefined();
  });
  it("authenticates new accounts, preserves sessions, and signs out", async () => {
    const request = (path: string, body: object, cookie = "") =>
      handle(
        new Request(`http://localhost:3000/api/auth/${path}`, {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            "content-type": "application/json",
            cookie,
          },
          body: JSON.stringify(body),
        }),
      );
    const response = await request("register", {
      username: "gamer_test",
      gamer_tag: "GamerTest",
      email: "gamer@test.invalid",
      password1: "Strong-password-123",
      password2: "Strong-password-123",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(
      (await list("profile")).some((p) => p.gamer_tag === "GamerTest"),
    ).toBe(true);
    const cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    expect(cookie).toContain("session_token");
    const me = await handle(
      new Request("http://localhost:3000/api/me", { headers: { cookie } }),
    );
    expect(me.status, await me.clone().text()).toBe(200);
    expect((await me.json()).profile.gamer_tag).toBe("GamerTest");
    expect((await request("logout", {}, cookie)).status).toBe(200);
    expect(
      (
        await handle(
          new Request("http://localhost:3000/api/me", { headers: { cookie } }),
        )
      ).status,
    ).toBe(401);
    const login = await request("login", {
      username: "gamer_test",
      password: "Strong-password-123",
    });
    expect(login.status, await login.clone().text()).toBe(200);
  });
  it("rejects malformed and oversized request bodies before authentication", async () => {
    const request = (body: string) => handle(new Request("http://localhost:3000/api/auth/login", {method:"POST", headers:{origin:"http://localhost:3000","content-type":"application/json"},body}));
    expect((await request("null")).status).toBe(400);
    expect((await request("[]")).status).toBe(400);
    expect((await request("x".repeat(100001))).status).toBe(413);
  });
  it("rejects cross-site writes and anonymous mutations", async () => {
    const res = await handle(
      new Request("http://localhost:3000/api/feed/create", {
        method: "POST",
        headers: {
          origin: "https://evil.invalid",
          "content-type": "application/json",
        },
        body: "{}",
      }),
    );
    expect(res.status).toBe(403);
  });
  it("creates and manages a tournament through completion", async () => {
    const t = await write("tournaments/create", {
      name: "Harare Cup",
      description: "Local free tournament",
      game: game.id,
      start_date: new Date(Date.now() + 86400000).toISOString(),
      registration_deadline: new Date(Date.now() + 3600000).toISOString(),
      max_participants: 2,
      rules: "Fair play",
      status: "Draft",
    });
    expect(
      ((await read("tournaments")) as unknown as RecordData[]).some(
        (row) => row.id === t.id,
      ),
    ).toBe(false);
    await expect(
      write(`tournaments/${t.slug}/publish`, {}, alice),
    ).rejects.toThrow("Only the organizer");
    await write(`tournaments/${t.slug}/publish`, {});
    await Promise.all([
      write(`tournaments/${t.slug}/register`, {}, alice),
      write(`tournaments/${t.slug}/register`, {}, bob),
    ]);
    await expect(write(`tournaments/${t.slug}/register`, {})).rejects.toThrow(
      "full",
    );
    await write(`tournaments/${t.slug}/bracket`, {});
    const detail = await read(`tournaments/${t.slug}`, owner);
    expect(detail.participant_count).toBe(2);
    expect(detail.matches).toHaveLength(1);
    await expect(write(`tournaments/${t.slug}/register`, {})).rejects.toThrow(
      "closed",
    );
    await expect(
      write(`tournaments/${t.slug}/result`, {
        match_id: 1,
        winner: "Outsider",
        score: "2-0",
      }),
    ).rejects.toThrow("valid player");
    await write(`tournaments/${t.slug}/result`, {
      match_id: 1,
      winner: detail.matches[0].player_one,
      score: "2-1",
    });
    expect((await read(`tournaments/${t.slug}`)).status).toBe("Completed");
    await expect(
      write(`tournaments/${t.slug}/result`, {
        match_id: 1,
        winner: detail.matches[0].player_one,
        score: "2-1",
      }),
    ).rejects.toThrow("not live");
  });
  it("enforces event capacity and supports withdrawal", async () => {
    const e = await write("events/create", {
      name: "LAN Night",
      description: "Bring your laptop",
      start_date: new Date(Date.now() + 86400000).toISOString(),
      location: "Harare",
      capacity: 1,
      status: "Published",
    });
    await write(`events/${e.id}/rsvp`, {}, alice);
    await expect(write(`events/${e.id}/rsvp`, {}, bob)).rejects.toThrow("full");
    await write(`events/${e.id}/leave`, {}, alice);
    await write(`events/${e.id}/rsvp`, {}, bob);
    expect((await read(`events/${e.id}`)).rsvp_count).toBe(1);
  });
  it("creates posts, comments, likes and saves", async () => {
    const post = await write("feed/create", {
      body: "Who is playing tonight?",
    });
    await write(`feed/posts/${post.id}/like`, {}, alice);
    await write(
      `feed/posts/${post.id}/comments`,
      { body: "Count me in" },
      alice,
    );
    const detail = await read(`feed/posts/${post.id}`, alice);
    expect(detail.like_count).toBe(1);
    expect(detail.comments[0].body).toBe("Count me in");
    expect(detail.likes).toBeUndefined();
  });
  it("keeps messages private and blocks unwanted contact", async () => {
    const request = await write("messages/start/Alice", {});
    expect(request.conversation_id).toBeUndefined();
    const pending = (await list("message_request")).find(
      (r) => r.sender_id === owner.id && r.recipient_id === alice.id,
    )!;
    await write(`message-requests/${pending.id}/accept`, {}, alice);
    const c = await write("messages/start/Alice", {});
    await write(`messages/${c.conversation_id}/send`, {
      content: "Hello Alice",
    });
    await expect(read(`messages/${c.conversation_id}`, bob)).rejects.toThrow(
      "not found",
    );
    expect(
      (await read(`messages/${c.conversation_id}`, alice)).messages[0].content,
    ).toBe("Hello Alice");
    await write("profiles/Owner/block", {}, alice);
    await expect(
      write(`messages/${c.conversation_id}/send`, { content: "blocked" }),
    ).rejects.toThrow("unavailable");
  });
  it("validates listings and limits seller actions", async () => {
    const l = await write("marketplace/create", {
      title: "Controller",
      description: "Good condition",
      category: "Controllers",
      price: 25,
      condition: "Good",
      location: "Harare",
    });
    await expect(write(`marketplace/${l.id}/sold`, {}, bob)).rejects.toThrow(
      "Only the seller",
    );
    await write(`marketplace/${l.id}/save`, {}, bob);
    expect((await read(`marketplace/${l.id}`, bob)).is_saved).toBe(true);
    await write(`marketplace/${l.id}/sold`, {});
    expect((await list("listing")).find((row) => row.id === l.id)?.status).toBe(
      "Sold",
    );
  });
  it("updates reviews without duplicates", async () => {
    await write(`games/${game.id}/reviews`, { rating: 4, review: "Fun" }, bob);
    await write(
      `games/${game.id}/reviews`,
      { rating: 5, review: "Excellent" },
      bob,
    );
    expect((await read(`games/${game.id}`, bob)).review_count).toBe(1);
  });
  it("finishes brackets with five players and three byes", async () => {
    const players = [];
    for (let i = 0; i < 5; i++)
      players.push(
        await ensureProfile({
          id: `bye${i}`,
          name: `Bye${i}`,
          email: `bye${i}@test.invalid`,
        }),
      );
    const t = await write("tournaments/create", {
      name: "Five Player Cup",
      description: "Odd field",
      game: game.id,
      start_date: new Date(Date.now() + 86400000).toISOString(),
      registration_deadline: new Date(Date.now() + 3600000).toISOString(),
      max_participants: 8,
      rules: "Fair play",
      status: "Open",
    });
    for (const p of players)
      await write(`tournaments/${t.slug}/register`, {}, p);
    await write(`tournaments/${t.slug}/bracket`, {});
    for (let i = 0; i < 10; i++) {
      const d = await read(`tournaments/${t.slug}`, owner);
      if (d.status === "Completed") break;
      const m = d.matches.find((m: RecordData) => !m.winner);
      expect(m.player_one).toBeTruthy();
      expect(m.player_two).toBeTruthy();
      await write(`tournaments/${t.slug}/result`, {
        match_id: m.id,
        winner: m.player_one,
        score: "2-0",
      });
    }
    expect((await read(`tournaments/${t.slug}`)).status).toBe("Completed");
  });
  it("supports profile edits and team membership without losing owner controls", async () => {
    await write(
      "profiles/edit",
      {
        bio: "Mobile player",
        location: "Harare",
        platform: "Mobile",
        availability: "Sometimes",
        location_public: false,
      },
      bob,
    );
    const p = await read("profiles/detail/Bob");
    expect(p.bio).toBe("Mobile player");
    expect(p.location).toBe("Zimbabwe");
    const t = await write("teams/create", {
      name: "Test Team",
      tag: "TT",
      description: "A team",
      game: game.id,
    });
    await write(`teams/${t.slug}/join`, {}, bob);
    expect((await read(`teams/${t.slug}`, bob)).is_member).toBe(true);
    await expect(write(`teams/${t.slug}/leave`, {})).rejects.toThrow(
      "transfer ownership",
    );
    await write(`teams/${t.slug}/leave`, {}, bob);
    expect((await read(`teams/${t.slug}`, bob)).is_member).toBe(false);
  });
});
