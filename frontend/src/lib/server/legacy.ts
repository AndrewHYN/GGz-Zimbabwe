import { createHash } from "node:crypto";
import { sql } from "kysely";
import { atomic, type RecordData, type Database } from "./db";
export interface LegacySnapshot {
  version: 1;
  tables: Record<string, RecordData[]>;
}
interface PlannedEntity {
  kind: string;
  id: number;
  data: RecordData;
}
interface Issue {
  table: string;
  id: number;
  problem: string;
}
const tableNames =
  /^(auth_user|accounts_[a-z_]+|games_[a-z_]+|events_[a-z_]+|teams_[a-z_]+|tournaments_[a-z_]+|marketplace_[a-z_]+)$/;
export function fingerprint(snapshot: LegacySnapshot) {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}
export interface LegacyOverrides {
  users?: Record<string, { email?: string; username?: string }>;
  gamerTags?: Record<string, string>;
}
export function planLegacy(
  snapshot: LegacySnapshot,
  mediaBase = process.env.MEDIA_PUBLIC_URL,
  overrides: LegacyOverrides = {},
) {
  if (
    snapshot.version !== 1 ||
    !snapshot.tables ||
    typeof snapshot.tables !== "object"
  )
    throw Error("Unsupported legacy snapshot format.");
  const originalSnapshot = snapshot;
  const numericFields = new Set([
    "user_id",
    "profile_id",
    "gamerprofile_id",
    "game_id",
    "author_id",
    "reviewer_id",
    "follower_id",
    "following_id",
    "blocker_id",
    "blocked_id",
    "profile_one_id",
    "profile_two_id",
    "sender_id",
    "receiver_id",
    "recipient_id",
    "giver_id",
    "post_id",
    "conversation_id",
    "owner_id",
    "player_id",
    "team_id",
    "inviter_id",
    "invitee_id",
    "organizer_id",
    "tournament_id",
    "challenger_id",
    "opponent_id",
    "player_one_id",
    "player_two_id",
    "winner_id",
    "organization_id",
    "location_id",
    "event_id",
    "attendee_id",
    "seller_id",
    "listing_id",
    "reported_profile_id",
    "reported_listing_id",
  ]);
  snapshot = {
    version: 1,
    tables: Object.fromEntries(
      Object.entries(snapshot.tables).map(([t, rows]) => [
        t,
        rows.map(
          (r) =>
            Object.fromEntries(
              Object.entries(r).map(([k, v]) => [
                k,
                (k === "id" || numericFields.has(k)) && v != null
                  ? Number(v)
                  : v,
              ]),
            ) as RecordData,
        ),
      ]),
    ),
  };
  for (const user of snapshot.tables.auth_user ?? [])
    Object.assign(user, overrides.users?.[String(user.id)] ?? {});
  for (const profile of snapshot.tables.accounts_gamerprofile ?? [])
    if (overrides.gamerTags?.[String(profile.id)])
      profile.gamer_tag = overrides.gamerTags[String(profile.id)];
  const issues: Issue[] = [];
  const entities: PlannedEntity[] = [];
  const rows = (name: string): RecordData[] => snapshot.tables[name] ?? [];
  const issue = (table: string, id: number, problem: string) =>
    issues.push({ table, id, problem });
  for (const [table, data] of Object.entries(snapshot.tables)) {
    if (!tableNames.test(table) || !Array.isArray(data))
      throw Error("Unsupported source table or invalid row collection.");
    const ids = new Set<number>();
    for (const row of data) {
      if (!Number.isSafeInteger(row.id) || row.id < 1 || ids.has(row.id))
        issue(table, row.id, "Invalid or duplicate source primary key.");
      ids.add(row.id);
    }
  }
  for (const required of ["auth_user", "accounts_gamerprofile", "games_game"])
    if (!snapshot.tables[required])
      issue(required, 0, "Required source table is missing.");
  const raw = (table: string, id: number) =>
    rows(table).find((r) => r.id === id);
  const ref = (
    source: string,
    r: RecordData,
    field: string,
    target: string,
    optional = false,
  ) => {
    const id = r[field];
    if (id == null && optional) return;
    if (!raw(target, id))
      issue(source, r.id, `Missing ${field} reference to ${target}.`);
  };
  const relations: Record<string, Record<string, string>> = {
    accounts_gamerprofile: { user_id: "auth_user" },
    accounts_gamerprofile_games: {
      gamerprofile_id: "accounts_gamerprofile",
      game_id: "games_game",
    },
    accounts_socialidentity: { user_id: "auth_user" },
    accounts_gamerpresence: { profile_id: "accounts_gamerprofile" },
    accounts_follow: {
      follower_id: "accounts_gamerprofile",
      following_id: "accounts_gamerprofile",
    },
    accounts_block: {
      blocker_id: "accounts_gamerprofile",
      blocked_id: "accounts_gamerprofile",
    },
    accounts_friendship: {
      profile_one_id: "accounts_gamerprofile",
      profile_two_id: "accounts_gamerprofile",
    },
    accounts_friendrequest: {
      sender_id: "accounts_gamerprofile",
      receiver_id: "accounts_gamerprofile",
    },
    accounts_respecttransaction: {
      giver_id: "accounts_gamerprofile",
      recipient_id: "accounts_gamerprofile",
    },
    accounts_post: { author_id: "accounts_gamerprofile" },
    accounts_comment: {
      post_id: "accounts_post",
      author_id: "accounts_gamerprofile",
    },
    accounts_postlike: {
      post_id: "accounts_post",
      user_id: "accounts_gamerprofile",
    },
    accounts_postsave: {
      post_id: "accounts_post",
      user_id: "accounts_gamerprofile",
    },
    accounts_conversationparticipant: {
      conversation_id: "accounts_conversation",
      profile_id: "accounts_gamerprofile",
    },
    accounts_message: {
      conversation_id: "accounts_conversation",
      sender_id: "accounts_gamerprofile",
    },
    accounts_messagerequest: {
      sender_id: "accounts_gamerprofile",
      recipient_id: "accounts_gamerprofile",
    },
    teams_team: { owner_id: "accounts_gamerprofile" },
    teams_teammembership: {
      team_id: "teams_team",
      player_id: "accounts_gamerprofile",
    },
    teams_teaminvitation: {
      team_id: "teams_team",
      inviter_id: "accounts_gamerprofile",
      invitee_id: "accounts_gamerprofile",
    },
    tournaments_tournament: {
      organizer_id: "accounts_gamerprofile",
      game_id: "games_game",
    },
    tournaments_tournamentregistration: {
      tournament_id: "tournaments_tournament",
      player_id: "accounts_gamerprofile",
    },
    tournaments_tournamentmatch: {
      tournament_id: "tournaments_tournament",
      game_id: "games_game",
    },
    tournaments_challenge: {
      challenger_id: "accounts_gamerprofile",
      opponent_id: "accounts_gamerprofile",
      game_id: "games_game",
    },
    events_organization: { owner_id: "accounts_gamerprofile" },
    events_organizationlocation: { organization_id: "events_organization" },
    events_organizationlocationrating: {
      location_id: "events_organizationlocation",
      user_id: "auth_user",
    },
    events_organizationlocationreview: {
      location_id: "events_organizationlocation",
      author_id: "accounts_gamerprofile",
    },
    events_event: { organizer_id: "accounts_gamerprofile" },
    events_eventrsvp: {
      event_id: "events_event",
      attendee_id: "accounts_gamerprofile",
    },
    marketplace_listing: { seller_id: "accounts_gamerprofile" },
    marketplace_listingimage: { listing_id: "marketplace_listing" },
    marketplace_savedlisting: {
      listing_id: "marketplace_listing",
      user_id: "accounts_gamerprofile",
    },
    games_gamereview: {
      game_id: "games_game",
      reviewer_id: "accounts_gamerprofile",
    },
    games_gamewishlist: {
      game_id: "games_game",
      profile_id: "accounts_gamerprofile",
    },
    accounts_notification: { recipient_id: "accounts_gamerprofile" },
  };
  for (const [table, fields] of Object.entries(relations))
    for (const r of rows(table))
      for (const [field, target] of Object.entries(fields))
        ref(table, r, field, target);
  for (const r of rows("tournaments_tournamentmatch"))
    for (const f of ["player_one_id", "player_two_id", "winner_id"])
      ref("tournaments_tournamentmatch", r, f, "accounts_gamerprofile", true);
  for (const table of [
    "accounts_post",
    "events_event",
    "teams_team",
    "marketplace_listing",
  ])
    for (const r of rows(table)) ref(table, r, "game_id", "games_game", true);
  for (const r of rows("events_event"))
    ref("events_event", r, "organization_id", "events_organization", true);
  const emails = new Set<string>();
  const usernames = new Set<string>();
  const tags = new Set<string>();
  for (const u of rows("auth_user")) {
    const email = String(u.email ?? "").toLowerCase();
    const username = String(u.username ?? "").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || emails.has(email))
      issue(
        "auth_user",
        u.id,
        "A unique valid email is required; resolve missing or duplicate emails explicitly.",
      );
    if (!/^[a-z0-9_.-]{3,30}$/.test(username) || usernames.has(username))
      issue(
        "auth_user",
        u.id,
        "Username needs an explicit mapping to a unique 3–30 character login.",
      );
    emails.add(email);
    usernames.add(username);
    if (
      u.password &&
      !String(u.password).startsWith("!") &&
      !/^pbkdf2_sha256\$[0-9]+\$[^$]+\$[A-Za-z0-9+/=]+$/.test(u.password)
    )
      issue(
        "auth_user",
        u.id,
        "Unsupported password algorithm. Export a supported hash or require a password reset before migration.",
      );
  }
  for (const p of rows("accounts_gamerprofile")) {
    const tag = String(p.gamer_tag).toLowerCase();
    if (tags.has(tag))
      issue(
        "accounts_gamerprofile",
        p.id,
        "Case-insensitive gamer tag collision.",
      );
    tags.add(tag);
  }
  if (
    rows("auth_user").some(
      (u) => !rows("accounts_gamerprofile").some((p) => p.user_id === u.id),
    )
  )
    issue(
      "accounts_gamerprofile",
      0,
      "Every imported account must have a profile.",
    );
  const file = (value: unknown, table: string, id: number) => {
    if (!value) return null;
    const path = String(value);
    if (/^https?:\/\//.test(path)) return path;
    if (!mediaBase || !/^https:\/\//.test(mediaBase)) {
      issue(
        table,
        id,
        "Relative media requires a verified HTTPS MEDIA_PUBLIC_URL.",
      );
      return null;
    }
    return `${mediaBase.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  };
  const cleanWebsite = (value: unknown) =>
    typeof value === "string" && /^https?:\/\//.test(value) ? value : "";
  const add = (kind: string, r: RecordData, data: Record<string, unknown>) => {
    entities.push({
      kind,
      id: r.id,
      data: {
        ...data,
        id: r.id,
        legacy_id: r.id,
        created_at: r.created_at ?? new Date(0).toISOString(),
      },
    });
  };
  const pSummary = (id: number) => {
    const p = raw("accounts_gamerprofile", id);
    return {
      id,
      gamer_tag: p?.gamer_tag ?? "GGz",
      avatar: p ? file(p.avatar, "accounts_gamerprofile", p.id) : null,
      username: raw("auth_user", p?.user_id)?.username ?? "",
    };
  };
  for (const g of rows("games_game")) add("game", g, { ...g });
  for (const p of rows("accounts_gamerprofile")) {
    const u = raw("auth_user", p.user_id);
    const presence = rows("accounts_gamerpresence").find(
      (r) => r.profile_id === p.id,
    );
    const completed = rows("tournaments_tournamentmatch").filter(
      (m) =>
        m.status === "Completed" &&
        [m.player_one_id, m.player_two_id].includes(p.id),
    );
    add("profile", p, {
      user_id: `legacy:${p.user_id}`,
      username: u?.username,
      gamer_tag: p.gamer_tag,
      avatar: file(p.avatar, "accounts_gamerprofile", p.id),
      cover: file(p.cover, "accounts_gamerprofile", p.id),
      bio: p.bio ?? "",
      location: p.location ?? "",
      city: p.city ?? "",
      country: p.country ?? "Zimbabwe",
      location_public: Boolean(p.location_public),
      platform: p.platform ?? "PC",
      rank: p.rank ?? "Unranked",
      availability: p.availability ?? "Sometimes",
      respect_points: p.respect_points ?? 0,
      tournament_wins: p.tournament_wins ?? 0,
      matches_played: completed.length,
      match_wins: completed.filter((m) => m.winner_id === p.id).length,
      games: rows("accounts_gamerprofile_games")
        .filter((r) => r.gamerprofile_id === p.id)
        .map((r) => r.game_id),
      wishlist: rows("games_gamewishlist")
        .filter((r) => r.profile_id === p.id)
        .map((r) => r.game_id),
      followers: rows("accounts_follow")
        .filter((r) => r.following_id === p.id)
        .map((r) => r.follower_id),
      following: rows("accounts_follow")
        .filter((r) => r.follower_id === p.id)
        .map((r) => r.following_id),
      blocked: rows("accounts_block")
        .filter((r) => r.blocker_id === p.id)
        .map((r) => r.blocked_id),
      friends: rows("accounts_friendship")
        .filter((r) => [r.profile_one_id, r.profile_two_id].includes(p.id))
        .map((r) =>
          r.profile_one_id === p.id ? r.profile_two_id : r.profile_one_id,
        ),
      friend_requests: rows("accounts_friendrequest")
        .filter((r) => r.receiver_id === p.id && r.status === "pending")
        .map((r) => r.sender_id),
      respected_by: rows("accounts_respecttransaction")
        .filter((r) => r.recipient_id === p.id)
        .map((r) => r.giver_id),
      show_online_status: presence?.show_online_status ?? false,
      show_last_seen: presence?.show_last_seen ?? false,
      presence: "offline",
      suspended_at: u?.is_active === false ? new Date(0).toISOString() : null,
    });
  }
  for (const p of rows("accounts_post"))
    add("post", p, {
      content: p.body,
      author: pSummary(p.author_id),
      game_id: p.game_id,
      game: raw("games_game", p.game_id)?.name ?? null,
      image: file(p.image, "accounts_post", p.id),
      visibility: "Public",
      likes: rows("accounts_postlike")
        .filter((r) => r.post_id === p.id)
        .map((r) => r.user_id),
      saves: rows("accounts_postsave")
        .filter((r) => r.post_id === p.id)
        .map((r) => r.user_id),
      comments: rows("accounts_comment")
        .filter((r) => r.post_id === p.id)
        .map((r) => ({
          id: r.id,
          body: r.body,
          author: pSummary(r.author_id),
          created_at: r.created_at,
        })),
    });
  for (const t of rows("tournaments_tournament")) {
    const participants = rows("tournaments_tournamentregistration")
      .filter((r) => r.tournament_id === t.id && r.status === "Registered")
      .map((r) => ({ ...pSummary(r.player_id), status: r.status }));
    const matches = rows("tournaments_tournamentmatch")
      .filter((r) => r.tournament_id === t.id)
      .map((r) => ({
        ...r,
        player_one: r.player_one_id
          ? pSummary(r.player_one_id).gamer_tag
          : null,
        player_two: r.player_two_id
          ? pSummary(r.player_two_id).gamer_tag
          : null,
        winner: r.winner_id ? pSummary(r.winner_id).gamer_tag : null,
      }));
    add("tournament", t, {
      ...t,
      banner: file(t.banner, "tournaments_tournament", t.id),
      organizer_id: t.organizer_id,
      organizer: pSummary(t.organizer_id),
      organizer_name: pSummary(t.organizer_id).gamer_tag,
      game_name: raw("games_game", t.game_id)?.name,
      status: t.status === "Registration Open" ? "Open" : t.status,
      mode: t.mode === "online" ? "Online" : "In Person",
      participants,
      participant_count: participants.length,
      matches,
    });
  }
  for (const t of rows("teams_team")) {
    const roster = rows("teams_teammembership")
      .filter((r) => r.team_id === t.id)
      .map((r) => ({
        ...pSummary(r.player_id),
        role: r.role,
        is_owner: r.player_id === t.owner_id,
      }));
    if (!roster.some((r) => r.id === t.owner_id))
      issue("teams_team", t.id, "Owner must be a roster member.");
    add("team", t, {
      ...t,
      logo: file(t.logo, "teams_team", t.id),
      banner: file(t.banner, "teams_team", t.id),
      owner_gamer_tag: pSummary(t.owner_id).gamer_tag,
      game_name: raw("games_game", t.game_id)?.name ?? null,
      roster,
      member_count: roster.length,
      wins: 0,
      losses: 0,
      matches_played: 0,
      win_rate: 0,
    });
  }
  for (const i of rows("teams_teaminvitation")) {
    const team = raw("teams_team", i.team_id);
    add("invitation", i, {
      ...i,
      type: "team",
      actor_id: i.inviter_id,
      actor: pSummary(i.inviter_id),
      recipient_id: i.invitee_id,
      recipient: pSummary(i.invitee_id),
      team_name: team?.name,
      team_slug: team?.slug,
    });
  }
  for (const o of rows("events_organization"))
    add("organization", o, {
      ...o,
      website: cleanWebsite(o.website),
      logo: file(o.logo, "events_organization", o.id),
    });
  for (const v of rows("events_organizationlocation")) {
    const org = raw("events_organization", v.organization_id);
    const reviews = rows("events_organizationlocationreview")
      .filter((r) => r.location_id === v.id)
      .map((r) => ({
        id: r.id,
        author: pSummary(r.author_id),
        body: r.review_text ?? "",
        rating: r.rating,
        created_at: r.created_at,
      }));
    for (const r of rows("events_organizationlocationrating").filter(
      (r) => r.location_id === v.id,
    ))
      if (
        !reviews.some(
          (a) =>
            a.author.id ===
            rows("accounts_gamerprofile").find((p) => p.user_id === r.user_id)
              ?.id,
        )
      )
        reviews.push({
          id: Math.max(0, ...reviews.map((a) => a.id)) + 1,
          author: pSummary(
            rows("accounts_gamerprofile").find((p) => p.user_id === r.user_id)
              ?.id ?? 0,
          ),
          body: "",
          rating: r.value,
          created_at: r.created_at,
        });
    add("venue", v, {
      ...v,
      organization_name: org?.name,
      owner_id: org?.owner_id,
      category: v.location_type ?? "Gaming Hub",
      website: cleanWebsite(v.website),
      public_visible: Boolean(v.public_visible),
      reviews,
    });
  }
  for (const v of rows("accounts_venue"))
    add("standalone_venue", v, {
      ...v,
      public_visible: true,
      owner_id: null,
      reviews: [],
      category: v.category ?? "Gaming Lounge",
      verification_status: "UNVERIFIED",
      website: cleanWebsite(v.website),
    });
  for (const e of rows("events_event")) {
    const attendees = rows("events_eventrsvp")
      .filter((r) => r.event_id === e.id)
      .map((r) => pSummary(r.attendee_id));
    add("event", e, {
      ...e,
      banner: file(e.banner, "events_event", e.id),
      organizer: pSummary(e.organizer_id),
      organizer_name: pSummary(e.organizer_id).gamer_tag,
      game_name: raw("games_game", e.game_id)?.name ?? null,
      organization_name:
        raw("events_organization", e.organization_id)?.name ?? null,
      mode: e.mode === "online" ? "Online" : "In Person",
      attendees,
      rsvp_count: attendees.length,
    });
  }
  for (const l of rows("marketplace_listing")) {
    const images = rows("marketplace_listingimage")
      .filter((r) => r.listing_id === l.id)
      .map((r) => file(r.image, "marketplace_listingimage", r.id));
    add("listing", l, {
      ...l,
      price: String(l.price),
      images,
      image: images[0] ?? null,
      seller: pSummary(l.seller_id),
      seller_name: pSummary(l.seller_id).gamer_tag,
      seller_avatar: pSummary(l.seller_id).avatar,
      game_name: raw("games_game", l.game_id)?.name ?? null,
      saves: rows("marketplace_savedlisting")
        .filter((r) => r.listing_id === l.id)
        .map((r) => r.user_id),
      save_count: rows("marketplace_savedlisting").filter(
        (r) => r.listing_id === l.id,
      ).length,
    });
  }
  for (const r of rows("games_gamereview"))
    add("review", r, {
      ...r,
      author_id: r.reviewer_id,
      reviewer: pSummary(r.reviewer_id),
    });
  for (const c of rows("accounts_conversation")) {
    const links = rows("accounts_conversationparticipant").filter(
      (r) => r.conversation_id === c.id,
    );
    const participants = links.map((r) => r.profile_id);
    const messages = rows("accounts_message")
      .filter((r) => r.conversation_id === c.id)
      .map((r) => {
        if (!participants.includes(r.sender_id))
          issue(
            "accounts_message",
            r.id,
            "Message sender is not a participant.",
          );
        return {
          ...r,
          content: r.body,
          sender: pSummary(r.sender_id).gamer_tag,
          read_by: links
            .filter(
              (l) =>
                l.profile_id === r.sender_id ||
                (l.last_read_at &&
                  new Date(l.last_read_at) >= new Date(r.created_at)),
            )
            .map((l) => l.profile_id),
        };
      });
    add("conversation", c, {
      participants,
      messages,
      updated_at: c.updated_at,
    });
  }
  for (const n of rows("accounts_notification"))
    add("notification", n, {
      ...n,
      recipient: n.recipient_id,
      actor: n.actor_id
        ? pSummary(n.actor_id)
        : { gamer_tag: "GGz", avatar: null },
      target_url: safeLegacyUrl(n.target_url),
    });
  for (const c of rows("tournaments_challenge"))
    add("challenge", c, {
      ...c,
      challenger: pSummary(c.challenger_id),
      opponent: pSummary(c.opponent_id),
      game_name: raw("games_game", c.game_id)?.name,
      status: c.status === "Completed" ? "Needs Reconciliation" : c.status,
    });
  for (const r of rows("accounts_report")) {
    const kind = r.post_id
      ? "post"
      : r.reported_profile_id
        ? "profile"
        : "listing";
    const id = r.post_id ?? r.reported_profile_id ?? r.reported_listing_id;
    add("report", r, {
      ...r,
      target_type: kind,
      target_id: id,
      status: "Open",
    });
  }
  for (const i of rows("tournaments_tournamentinvitation")) {
    const t = raw("tournaments_tournament", i.tournament_id);
    if (!t) {
      issue("tournaments_tournamentinvitation", i.id, "Tournament is missing.");
      continue;
    }
    add("tournament_invitation", i, {
      ...i,
      recipient_id: i.player_id,
      recipient: pSummary(i.player_id),
      actor_id: t.organizer_id,
      actor: pSummary(t.organizer_id),
      team_name: t.name,
      target_url: `/tournaments/${t.slug}`,
    });
  }
  for (const r of rows("accounts_messagerequest"))
    add("message_request", r, {
      ...r,
      sender: pSummary(r.sender_id),
      recipient: pSummary(r.recipient_id),
    });
  // Preserve auxiliary records as private entities, in addition to the lossless archive.
  for (const [table, kind] of Object.entries({
    events_eventpromotionrequest: "promotion",
    accounts_externalfeeditem: "external_feed",
    accounts_pushsubscription: "legacy_push_subscription",
  }))
    for (const row of rows(table)) add(kind, row, { ...row });
  const sourceCounts = Object.fromEntries(
    Object.entries(snapshot.tables).map(([table, data]) => [
      table,
      data.length,
    ]),
  );
  const targetCounts: Record<string, number> = {};
  for (const e of entities)
    targetCounts[e.kind] = (targetCounts[e.kind] ?? 0) + 1;
  return {
    entities,
    users: rows("auth_user"),
    identities: rows("accounts_socialidentity"),
    report: {
      fingerprint: createHash("sha256")
        .update(
          JSON.stringify({
            source: fingerprint(originalSnapshot),
            entities,
            users: rows("auth_user"),
            identities: rows("accounts_socialidentity"),
          }),
        )
        .digest("hex"),
      sourceFingerprint: fingerprint(originalSnapshot),
      sourceCounts,
      targetCounts,
      archiveRows: Object.values(snapshot.tables).reduce(
        (n, r) => n + r.length,
        0,
      ),
      issues,
      ready: issues.length === 0,
    },
  };
}
function safeLegacyUrl(value: unknown) {
  const url = String(value ?? "");
  if (!url.startsWith("/") || url.startsWith("//")) return "/dashboard";
  return url.replace(/^\/profiles\/(?!detail\/)/, "/profiles/");
}
export async function importLegacy(
  snapshot: LegacySnapshot,
  options: {
    apply?: boolean;
    expectedFingerprint?: string;
    mediaBase?: string;
    overrides?: LegacyOverrides;
  } = {},
) {
  const plan = planLegacy(snapshot, options.mediaBase, options.overrides);
  if (!options.apply)
    return { ...plan.report, applied: false, alreadyApplied: false };
  if (!plan.report.ready)
    throw Error(
      `Import blocked by ${plan.report.issues.length} validation issue(s). Run the dry run and resolve them first.`,
    );
  if (options.expectedFingerprint !== plan.report.fingerprint)
    throw Error("Snapshot fingerprint does not match the reviewed dry run.");
  return atomic(async (db) => {
    const previous = await sql<{
      fingerprint: string;
      manifest: RecordData;
    }>`select fingerprint,manifest from ggz_import_run`.execute(db);
    if (previous.rows.some((r) => r.fingerprint === plan.report.fingerprint))
      return { ...plan.report, applied: true, alreadyApplied: true };
    if (previous.rows.length)
      throw Error(
        "A different snapshot was already imported. Reconcile before importing again.",
      );
    const occupied = await sql<{
      count: string;
    }>`select (select count(*) from ggz_entity)+(select count(*) from ggz_user) as count`.execute(
      db,
    );
    if (Number(occupied.rows[0].count) !== 0)
      throw Error(
        "Import target is not empty. Use an isolated migration database; existing accounts will never be overwritten.",
      );
    for (const u of plan.users) {
      const id = `legacy:${u.id}`;
      await sql`insert into ggz_user(id,name,email,"emailVerified",username,"displayUsername","createdAt","updatedAt") values(${id},${String(u.username)},${String(u.email).toLowerCase()},false,${String(u.username).toLowerCase()},${String(u.username)},${u.date_joined ?? new Date(0).toISOString()},${u.date_joined ?? new Date(0).toISOString()})`.execute(
        db,
      );
      if (u.password && !String(u.password).startsWith("!"))
        await sql`insert into ggz_account(id,"accountId","providerId","userId",password) values(${`credential:${u.id}`},${id},'credential',${id},${u.password})`.execute(
          db,
        );
      if (u.is_superuser || u.is_staff)
        await sql`insert into ggz_staff(user_id,role) values(${id},${u.is_superuser ? "admin" : "moderator"})`.execute(
          db,
        );
    }
    for (const i of plan.identities)
      await sql`insert into ggz_account(id,"accountId","providerId","userId") values(${`social:${i.id}`},${String(i.provider_user_id)},${i.provider},${`legacy:${i.user_id}`})`.execute(
        db,
      );
    for (const e of plan.entities)
      await db
        .insertInto("ggz_entity")
        .values({ kind: e.kind, id: e.id, data: e.data })
        .execute();
    const checksum = await entityChecksum(db);
    await sql`insert into ggz_import_run(fingerprint,manifest) values(${plan.report.fingerprint},${JSON.stringify({ ...plan.report, entityChecksum: checksum, authChecksum: await authChecksum(db), userCount: plan.users.length, accountCount: plan.identities.length + plan.users.filter((u) => u.password && !String(u.password).startsWith("!")).length })}::jsonb)`.execute(
      db,
    );
    for (const [table, data] of Object.entries(snapshot.tables))
      for (const row of data)
        await sql`insert into ggz_legacy_archive(fingerprint,source_table,legacy_id,record) values(${plan.report.fingerprint},${table},${String(row.id)},${JSON.stringify(row)}::jsonb)`.execute(
          db,
        );
    await sql`select setval(pg_get_serial_sequence('ggz_entity','id'),greatest(coalesce((select max(id) from ggz_entity),0)+1,1),false)`.execute(
      db,
    );
    return { ...plan.report, applied: true, alreadyApplied: false };
  });
}
async function entityChecksum(db: Database) {
  const rows = await db
    .selectFrom("ggz_entity")
    .select(["id", "kind", "data"])
    .orderBy("kind")
    .orderBy("id")
    .execute();
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
export async function rollbackLegacy(expectedFingerprint: string) {
  return atomic(async (db) => {
    const row = (
      await sql<{
        manifest: RecordData;
      }>`select manifest from ggz_import_run where fingerprint=${expectedFingerprint}`.execute(
        db,
      )
    ).rows[0];
    if (!row) throw Error("Import run not found.");
    if (
      (await entityChecksum(db)) !== row.manifest.entityChecksum ||
      (await authChecksum(db)) !== row.manifest.authChecksum
    )
      throw Error(
        "Application data changed after import; rollback would lose data and is refused.",
      );
    const counts = (
      await sql<{
        users: string;
        accounts: string;
        sessions: string;
        verification: string;
      }>`select (select count(*) from ggz_user) as users,(select count(*) from ggz_account) as accounts,(select count(*) from ggz_session) as sessions,(select count(*) from ggz_verification) as verification`.execute(
        db,
      )
    ).rows[0];
    if (
      Number(counts.users) !== row.manifest.userCount ||
      Number(counts.accounts) !== row.manifest.accountCount ||
      Number(counts.sessions) > 0 ||
      Number(counts.verification) > 0
    )
      throw Error(
        "Account activity occurred after import; rollback is refused.",
      );
    await db.deleteFrom("ggz_entity").execute();
    await sql`delete from ggz_user`.execute(db);
    await sql`delete from ggz_legacy_archive where fingerprint=${expectedFingerprint}`.execute(
      db,
    );
    await sql`delete from ggz_import_run where fingerprint=${expectedFingerprint}`.execute(
      db,
    );
    return { rolledBack: true };
  });
}
export async function exportLegacy(client: {
  query: (text: string) => Promise<{ rows: RecordData[] }>;
}): Promise<LegacySnapshot> {
  const tables: Record<string, RecordData[]> = {};
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const { rows } = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
    );
    for (const row of rows) {
      const name = String(row.table_name);
      if (tableNames.test(name)) {
        const result = await client.query(
          `SELECT * FROM "${name}" ORDER BY id`,
        );
        tables[name] = JSON.parse(JSON.stringify(result.rows));
      }
    }
    await client.query("ROLLBACK");
    return { version: 1, tables };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function authChecksum(db: Database) {
  const data = [];
  for (const table of ["ggz_user", "ggz_account", "ggz_staff"]) {
    const result = await sql
      .raw(`SELECT * FROM ${table} ORDER BY 1`)
      .execute(db);
    data.push(result.rows);
  }
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}
