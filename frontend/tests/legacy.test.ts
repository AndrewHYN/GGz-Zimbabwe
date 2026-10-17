import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { pbkdf2Sync } from "node:crypto";
import { sql } from "kysely";
import { migrate } from "../src/lib/server/schema";
import { database, list, find, insert } from "../src/lib/server/db";
import {
  importLegacy,
  rollbackLegacy,
  type LegacySnapshot,
} from "../src/lib/server/legacy";
import { readPlatform } from "../src/lib/server/platform";
import { handle } from "../src/lib/server/handler";
process.env.GGZ_LOCAL_DATABASE = "memory://";
process.env.BETTER_AUTH_SECRET =
  "legacy-fixture-only-secret-more-than-32-characters";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
const stamp = "2026-01-01T12:00:00Z";
const password =
  "pbkdf2_sha256$1000$salt$" +
  pbkdf2Sync("Legacy-password-123", "salt", 1000, 32, "sha256").toString(
    "base64",
  );
const fixture = (): LegacySnapshot => ({
  version: 1,
  tables: {
    auth_user: [
      {
        id: 101,
        username: "legacy_owner",
        email: "owner@test.invalid",
        password,
        is_active: true,
        is_superuser: true,
        date_joined: stamp,
      },
      {
        id: 102,
        username: "legacy_player",
        email: "player@test.invalid",
        password,
        is_active: true,
        date_joined: stamp,
      },
    ],
    accounts_gamerprofile: [
      {
        id: 1,
        user_id: 101,
        gamer_tag: "LegacyOwner",
        bio: "Original bio",
        platform: "PC",
        rank: "Gold",
        availability: "Available",
        respect_points: 7,
        tournament_wins: 1,
        location_public: false,
        created_at: stamp,
      },
      {
        id: 2,
        user_id: 102,
        gamer_tag: "LegacyPlayer",
        platform: "PC",
        created_at: stamp,
      },
    ],
    games_game: [
      {
        id: 1,
        name: "Legacy Fighter",
        description: "Original game",
        genre: "Fighting",
        platform: "PC",
      },
    ],
    accounts_gamerprofile_games: [{ id: 1, gamerprofile_id: 2, game_id: 1 }],
    accounts_follow: [{ id: 1, follower_id: 2, following_id: 1 }],
    accounts_friendship: [{ id: 1, profile_one_id: 1, profile_two_id: 2 }],
    accounts_respecttransaction: [{ id: 1, giver_id: 2, recipient_id: 1 }],
    accounts_post: [
      {
        id: 1,
        author_id: 1,
        game_id: 1,
        body: "Original post",
        created_at: stamp,
      },
    ],
    accounts_comment: [
      {
        id: 1,
        post_id: 1,
        author_id: 2,
        body: "Original comment",
        created_at: stamp,
      },
    ],
    accounts_postlike: [{ id: 1, post_id: 1, user_id: 2 }],
    teams_team: [
      {
        id: 1,
        owner_id: 1,
        game_id: 1,
        name: "Original Squad",
        slug: "original-squad",
        tag: "OS",
        status: "Active",
        description: "A squad",
      },
    ],
    teams_teammembership: [
      { id: 1, team_id: 1, player_id: 1, role: "Captain" },
      { id: 2, team_id: 1, player_id: 2, role: "Member" },
    ],
    tournaments_tournament: [
      {
        id: 1,
        organizer_id: 1,
        game_id: 1,
        name: "Original Cup",
        slug: "original-cup",
        format: "1v1",
        status: "Completed",
        mode: "online",
        max_participants: 8,
        start_date: stamp,
        registration_deadline: stamp,
      },
    ],
    tournaments_tournamentregistration: [
      { id: 1, tournament_id: 1, player_id: 1, status: "Registered" },
      { id: 2, tournament_id: 1, player_id: 2, status: "Registered" },
    ],
    tournaments_tournamentmatch: [
      {
        id: 1,
        tournament_id: 1,
        game_id: 1,
        player_one_id: 1,
        player_two_id: 2,
        winner_id: 1,
        round: 1,
        score: "2-1",
        status: "Completed",
      },
    ],
    events_organization: [
      {
        id: 1,
        owner_id: 1,
        name: "Original Club",
        slug: "original-club",
        description: "A club",
        organization_type: "Community",
        verification_status: "Verified",
      },
    ],
    events_organizationlocation: [
      {
        id: 1,
        organization_id: 1,
        name: "Original Venue",
        city: "Harare",
        address: "Test Street",
        latitude: -17.8,
        longitude: 31,
        public_visible: true,
        verification_status: "VERIFIED",
      },
    ],
    events_organizationlocationrating: [
      { id: 1, location_id: 1, user_id: 102, value: 4 },
    ],
    events_organizationlocationreview: [
      {
        id: 1,
        location_id: 1,
        author_id: 2,
        rating: 4,
        review_text: "Original venue review",
        created_at: stamp,
      },
    ],
    events_event: [
      {
        id: 1,
        organizer_id: 1,
        organization_id: 1,
        name: "Original Event",
        status: "Published",
        mode: "online",
        capacity: null,
        start_date: stamp,
      },
    ],
    events_eventrsvp: [{ id: 1, event_id: 1, attendee_id: 2 }],
    marketplace_listing: [
      {
        id: 1,
        seller_id: 1,
        title: "Original controller",
        description: "Good",
        price: "15.50",
        status: "Available",
        category: "Controllers",
        condition: "Good",
        location: "Harare",
      },
    ],
    marketplace_savedlisting: [{ id: 1, listing_id: 1, user_id: 2 }],
    games_gamereview: [
      {
        id: 1,
        game_id: 1,
        reviewer_id: 2,
        rating: 5,
        review: "Original game review",
      },
    ],
    accounts_conversation: [{ id: 1, created_at: stamp, updated_at: stamp }],
    accounts_conversationparticipant: [
      { id: 1, conversation_id: 1, profile_id: 1, last_read_at: stamp },
      { id: 2, conversation_id: 1, profile_id: 2, last_read_at: stamp },
    ],
    accounts_message: [
      {
        id: 1,
        conversation_id: 1,
        sender_id: 1,
        body: "Original private message",
        created_at: stamp,
      },
    ],
    accounts_notification: [
      {
        id: 1,
        recipient_id: 2,
        actor_id: 1,
        notification_type: "Community",
        message: "Original notification",
        target_url: "/feed/posts/1",
        is_read: false,
        created_at: stamp,
      },
    ],
  },
});
beforeAll(migrate);
afterAll(async () => {
  await (await database()).destroy();
});
describe("Record-preserving legacy migration", () => {
  it("dry-runs without writing accounts, content or archives", async () => {
    const report = await importLegacy(fixture());
    expect(report.ready, JSON.stringify(report.issues)).toBe(true);
    expect(report.applied).toBe(false);
    expect(await list("profile")).toEqual([]);
    const counts = await sql<{
      count: string;
    }>`select count(*) as count from ggz_user`.execute(await database());
    expect(Number(counts.rows[0].count)).toBe(0);
  });
  it("blocks broken references, missing emails and unreviewed snapshots", async () => {
    const bad = fixture();
    bad.tables.accounts_comment[0].author_id = 999;
    expect((await importLegacy(bad)).ready).toBe(false);
    const email = fixture();
    email.tables.auth_user[0].email = "";
    expect(
      (await importLegacy(email)).issues.some((i) => i.table === "auth_user"),
    ).toBe(true);
    await expect(
      importLegacy(fixture(), { apply: true, expectedFingerprint: "wrong" }),
    ).rejects.toThrow("fingerprint");
  });
  it("accepts explicit account mappings while preserving the original archive", async () => {
    const input = fixture();
    input.tables.auth_user[0].email = "";
    const report = await importLegacy(input, {
      overrides: { users: { 101: { email: "mapped@test.invalid" } } },
    });
    expect(report.ready).toBe(true);
    expect(input.tables.auth_user[0].email).toBe("");
    expect(report.fingerprint).not.toBe(
      (await importLegacy(fixture())).fingerprint,
    );
  });
  it("preserves IDs, relationships, messages, reviews, staff and source row counts", async () => {
    const source = fixture();
    const dry = await importLegacy(source);
    await importLegacy(source, {
      apply: true,
      expectedFingerprint: dry.fingerprint,
    });
    expect((await find("profile", 1))?.gamer_tag).toBe("LegacyOwner");
    expect((await find("game", 1))?.name).toBe("Legacy Fighter");
    expect((await find("post", 1))?.comments[0].body).toBe("Original comment");
    expect((await find("profile", 1))?.followers).toEqual([2]);
    expect((await find("conversation", 1))?.messages[0].content).toBe(
      "Original private message",
    );
    expect((await find("venue", 1))?.reviews[0].body).toBe(
      "Original venue review",
    );
    expect((await find("venue", 1))?.reviews[0].rating).toBe(4);
    const archived = await sql<{
      count: string;
    }>`select count(*) as count from ggz_legacy_archive`.execute(
      await database(),
    );
    expect(Number(archived.rows[0].count)).toBe(dry.archiveRows);
    const ranks = await readPlatform(
      ["leaderboards"],
      new URLSearchParams({ game: "1" }),
    );
    expect((ranks as { gamer_tag: string; wins: number }[])[0]).toMatchObject({
      gamer_tag: "LegacyOwner",
      wins: 1,
    });
    expect(
      (
        await importLegacy(source, {
          apply: true,
          expectedFingerprint: dry.fingerprint,
        })
      ).alreadyApplied,
    ).toBe(true);
  });
  it("rolls back untouched imports without touching the legacy source", async () => {
    const dry = await importLegacy(fixture());
    await rollbackLegacy(dry.fingerprint);
    expect(await list("profile")).toEqual([]);
    expect(fixture().tables.accounts_message[0].body).toBe(
      "Original private message",
    );
  });
  it("normalizes pg bigint IDs and refuses rollback after new activity", async () => {
    const source = fixture();
    source.tables.games_game[0].id = "1" as unknown as number;
    source.tables.accounts_gamerprofile[0].user_id = "101";
    const dry = await importLegacy(source);
    expect(dry.ready).toBe(true);
    await importLegacy(source, {
      apply: true,
      expectedFingerprint: dry.fingerprint,
    });
    await insert("post", { content: "New activity" });
    await expect(rollbackLegacy(dry.fingerprint)).rejects.toThrow("changed");
    const all = await list("post");
    for (const p of all)
      if (p.content === "New activity")
        await (await database())
          .deleteFrom("ggz_entity")
          .where("kind", "=", "post")
          .where("id", "=", p.id)
          .execute();
    await rollbackLegacy(dry.fingerprint);
  });
  it("authenticates a migrated Django password without resetting it", async () => {
    const source = fixture();
    const dry = await importLegacy(source);
    await importLegacy(source, {
      apply: true,
      expectedFingerprint: dry.fingerprint,
    });
    const response = await handle(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          username: "legacy_owner",
          password: "Legacy-password-123",
        }),
      }),
    );
    expect(response.status, await response.clone().text()).toBe(200);
    expect(
      response.headers.getSetCookie().some((c) => c.includes("session_token")),
    ).toBe(true);
    await expect(rollbackLegacy(dry.fingerprint)).rejects.toThrow("activity");
  });
});
