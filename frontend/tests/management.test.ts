import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { sql } from "kysely";
import { migrate } from "../src/lib/server/schema";
import {
  database,
  insert,
  list,
  find,
  type RecordData,
} from "../src/lib/server/db";
import {
  ensureProfile,
  readPlatform,
  mutatePlatform,
} from "../src/lib/server/platform";
process.env.GGZ_LOCAL_DATABASE = "memory://";
process.env.BETTER_AUTH_SECRET =
  "management-tests-only-secret-at-least-32-characters";
let owner: RecordData,
  player: RecordData,
  stranger: RecordData,
  admin: RecordData,
  moderator: RecordData,
  game: RecordData;
const read = (path: string, viewer?: RecordData, q = new URLSearchParams()) =>
  readPlatform(path.split("/"), q, viewer) as Promise<RecordData>;
const write = (path: string, body: Record<string, unknown>, viewer = owner) =>
  mutatePlatform(path.split("/"), body, viewer) as Promise<RecordData>;
beforeAll(async () => {
  await migrate();
  const people = [];
  for (const name of ["Owner", "Player", "Stranger", "Admin", "Moderator"]) {
    await sql`insert into ggz_user(id,name,email) values(${name},${name},${name + "@test.invalid"})`.execute(
      await database(),
    );
    people.push(
      await ensureProfile({ id: name, name, email: name + "@test.invalid" }),
    );
  }
  [owner, player, stranger, admin, moderator] = people;
  for (const [p, role] of [
    [admin, "admin"],
    [moderator, "moderator"],
  ] as const)
    await sql`insert into ggz_staff(user_id,role) values(${p.user_id},${role})`.execute(
      await database(),
    );
  game = await insert("game", {
    name: "Management Fighter",
    genre: "Fighting",
    platform: "PC",
  });
});
afterAll(async () => {
  await (await database()).destroy();
});
describe("Ownership, consent and moderation", () => {
  it("allows organization owners to manage venues without exposing private drafts", async () => {
    const o = await write("organizations/create", {
      name: "Local Club",
      description: "A club",
      organization_type: "Community",
      city: "Harare",
    });
    await expect(
      write(`organizations/${o.slug}/edit`, { name: "Stolen" }, stranger),
    ).rejects.toThrow("Only the owner");
    const v = await write(`organizations/${o.slug}/venue`, {
      name: "Local Lounge",
      description: "A lounge",
      city: "Harare",
      address: "Test Street",
      latitude: -17.8,
      longitude: 31,
      public_visible: false,
    });
    await expect(read(`venues/${v.id}`, stranger)).rejects.toThrow("not found");
    expect((await read(`venues/${v.id}`, owner)).is_owner).toBe(true);
    const radar = await read("radar/map", stranger);
    expect(radar.venues.some((row: RecordData) => row.id === v.id)).toBe(false);
    await write(`venues/${v.id}/edit`, { ...v, public_visible: true });
    expect((await read(`venues/${v.id}`, stranger)).name).toBe("Local Lounge");
    await write(
      `venues/${v.id}/review`,
      { rating: 4, body: "Great venue" },
      player,
    );
    await write(
      `venues/${v.id}/review`,
      { rating: 5, body: "Updated review" },
      player,
    );
    expect((await read(`venues/${v.id}`, stranger)).rating_count).toBe(1);
    await expect(
      write(`venues/${v.id}/review`, { rating: 5, body: "My venue" }),
    ).rejects.toThrow("Owners cannot");
    await write(
      "admin/content",
      {
        kind: "organization",
        id: o.id,
        decision: "verify",
        reason: "Verified organization ownership",
      },
      moderator,
    );
    expect((await read(`organizations/${o.slug}`)).verification_status).toBe(
      "Verified",
    );
    await write(
      "admin/content",
      {
        kind: "venue",
        id: v.id,
        decision: "hide",
        reason: "Pending address review",
      },
      moderator,
    );
    await expect(read(`venues/${v.id}`, stranger)).rejects.toThrow("not found");
  });
  it("requires invitation acceptance and transfers ownership atomically", async () => {
    const t = await write("teams/create", {
      name: "Safe Squad",
      tag: "SAFE",
      description: "Our squad",
      game: game.id,
    });
    const i = await write(`teams/${t.slug}/invite`, {
      gamer_tag: player.gamer_tag,
    });
    await expect(
      write(`invitations/${i.id}/accept`, {}, stranger),
    ).rejects.toThrow("recipient");
    await write(`invitations/${i.id}/accept`, {}, player);
    await expect(
      write(`invitations/${i.id}/accept`, {}, player),
    ).rejects.toThrow("already");
    const transfer = await write(`teams/${t.slug}/transfer`, {
      gamer_tag: player.gamer_tag,
    });
    expect((await find("team", t.id))?.owner_id).toBe(owner.id);
    await write(`invitations/${transfer.id}/accept`, {}, player);
    expect((await find("team", t.id))?.owner_id).toBe(player.id);
    await expect(
      write(`teams/${t.slug}/remove`, { gamer_tag: player.gamer_tag }),
    ).rejects.toThrow("Only the owner");
  });
  it("keeps challenge results unranked until the other player confirms", async () => {
    const c = await write(`games/${game.id}/challenge`, {
      opponent: player.id,
    });
    await expect(
      write(`challenges/${c.id}/accept`, {}, stranger),
    ).rejects.toThrow("private");
    await write(`challenges/${c.id}/accept`, {}, player);
    await write(
      `challenges/${c.id}/schedule`,
      { scheduled_at: new Date(Date.now() + 3600000).toISOString() },
      player,
    );
    await write(`challenges/${c.id}/result`, {
      winner: owner.gamer_tag,
      score: "2-1",
    });
    await expect(write(`challenges/${c.id}/confirm`, {})).rejects.toThrow(
      "other player",
    );
    expect(
      (await read(
        "leaderboards",
        owner,
        new URLSearchParams({ game: String(game.id) }),
      )) as unknown,
    ).toEqual([]);
    await write(`challenges/${c.id}/confirm`, {}, player);
    const ranks = await read(
      "leaderboards",
      owner,
      new URLSearchParams({ game: String(game.id) }),
    );
    expect(ranks[0].gamer_tag).toBe(owner.gamer_tag);
    expect(ranks[0].wins).toBe(1);
    await expect(
      write(`challenges/${c.id}/confirm`, {}, player),
    ).rejects.toThrow("other player");
  });
  it("routes disputes to staff without awarding unverified wins", async () => {
    const c = await write(`games/${game.id}/challenge`, {
      opponent: stranger.id,
    });
    await write(`challenges/${c.id}/accept`, {}, stranger);
    await write(`challenges/${c.id}/result`, {
      winner: owner.gamer_tag,
      score: "3-0",
    });
    await write(
      `challenges/${c.id}/dispute`,
      { reason: "Wrong score" },
      stranger,
    );
    expect((await find("challenge", c.id))?.status).toBe("Disputed");
    await expect(
      write(
        "admin/content",
        {
          kind: "challenge",
          id: c.id,
          decision: "resolve-match",
          winner: stranger.gamer_tag,
          reason: "Evidence reviewed",
        },
        player,
      ),
    ).rejects.toThrow("Staff");
    await write(
      "admin/content",
      {
        kind: "challenge",
        id: c.id,
        decision: "resolve-match",
        winner: stranger.gamer_tag,
        reason: "Evidence reviewed",
      },
      moderator,
    );
    expect((await find("challenge", c.id))?.status).toBe("Completed");
  });
  it("protects moderation and account suspension with server-held roles", async () => {
    const post = await write("feed/create", { body: "Moderation test" });
    await expect(read("admin", stranger)).rejects.toThrow("Staff");
    await write(
      "admin/content",
      {
        kind: "post",
        id: post.id,
        decision: "hide",
        reason: "Community rule violation",
      },
      moderator,
    );
    await expect(read(`feed/posts/${post.id}`, player)).rejects.toThrow(
      "Not found",
    );
    await expect(
      write(`feed/posts/${post.id}/like`, {}, player),
    ).rejects.toThrow("not found");
    await expect(
      write(
        "admin/content",
        {
          kind: "profile",
          id: stranger.id,
          decision: "suspend",
          reason: "Serious violation",
        },
        moderator,
      ),
    ).rejects.toThrow("Only administrators");
    await write(
      "admin/content",
      {
        kind: "profile",
        id: stranger.id,
        decision: "suspend",
        reason: "Reviewed violation",
      },
      admin,
    );
    await expect(
      write("feed/create", { body: "Cannot post" }, stranger),
    ).rejects.toThrow("suspended");
    expect((await list("audit")).length).toBeGreaterThan(0);
  });
  it("reconciles legacy challenge winners without double-counting imported profile totals", async () => {
    const prior = await find("profile", player.id);
    const challenge = await insert("challenge", {challenger: {id: owner.id,gamer_tag:owner.gamer_tag},opponent:{id:player.id,gamer_tag:player.gamer_tag},game_id:game.id,status:"Needs Reconciliation"});
    await write("admin/content", {kind:"challenge", id:challenge.id, decision:"resolve-match", winner:player.gamer_tag,reason:"Reviewed archived match evidence"}, admin);
    expect((await find("challenge", challenge.id))?.status).toBe("Completed");
    expect((await find("profile", player.id))?.matches_played).toBe(prior?.matches_played);
    await expect(write("admin/content", {kind:"challenge",id:challenge.id,decision:"resolve-match",winner:player.gamer_tag,reason:"Duplicate reconciliation"},admin)).rejects.toThrow("resolution");
  });
  it("validates coordinates and adds games to a player library", async () => {
    const o = (await list("organization"))[0];
    await expect(
      write(`organizations/${o.slug}/venue`, {
        name: "Bad",
        description: "Bad",
        city: "Harare",
        address: "Nowhere",
        latitude: "",
        longitude: 31,
      }),
    ).rejects.toThrow();
    await write(`games/${game.id}/library`, {}, player);
    expect(
      (await read(`games/${game.id}`, await find("profile", player.id)))
        .in_library,
    ).toBe(true);
  });
  it("handles tournament invitations and owner-only event transitions", async () => {
    const t = await write("tournaments/create", {
      name: "Invite Cup",
      description: "Invite test",
      game: game.id,
      start_date: new Date(Date.now() + 86400000).toISOString(),
      registration_deadline: new Date(Date.now() + 3600000).toISOString(),
      max_participants: 4,
      rules: "Fair play",
      status: "Open",
    });
    const invitation = await write(`tournaments/${t.slug}/invite`, {
      gamer_tag: player.gamer_tag,
    });
    await expect(
      write(`invitations/tournament-${invitation.id}/accept`, {}, admin),
    ).rejects.toThrow("recipient");
    await write(`invitations/tournament-${invitation.id}/accept`, {}, player);
    expect((await find("tournament", t.id))?.participant_count).toBe(1);
    const org = (await list("organization"))[0];
    const e = await write("events/create", {
      name: "Club Event",
      description: "Our gathering",
      organization_id: org.id,
      start_date: new Date(Date.now() + 86400000).toISOString(),
      capacity: 10,
      location: "Harare",
      status: "Draft",
    });
    await expect(write(`events/${e.id}/publish`, {}, player)).rejects.toThrow(
      "organizer",
    );
    const promotion = await write(`events/${e.id}/promotion`, {
      campaign_description: "Community tournament campaign",
    });
    await expect(
      write(
        `admin/promotion/${promotion.id}`,
        { decision: "approve", reason: "Reviewed" },
        player,
      ),
    ).rejects.toThrow("Staff");
    await write(
      `admin/promotion/${promotion.id}`,
      { decision: "approve", reason: "Reviewed community event" },
      admin,
    );
    expect((await find("event", e.id))?.featured).toBe(true);
    await expect(
      write(`events/${e.id}/promotion`, { campaign_description: "Duplicate" }),
    ).rejects.toThrow("already open");
    await write(`events/${e.id}/publish`, {});
    await write(`events/${e.id}/start`, {});
    await write(`events/${e.id}/complete`, {});
    expect((await find("event", e.id))?.status).toBe("Completed");
  });
});
