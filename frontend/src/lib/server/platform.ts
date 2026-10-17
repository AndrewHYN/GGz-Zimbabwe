import { readManagement, mutateManagement, rankings } from "./management";
import { z } from "zod";
import { sql } from "kysely";
import {
  atomic,
  find,
  insert,
  list,
  save,
  type Database,
  type RecordData,
} from "./db";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function check(
  value: unknown,
  message: string,
  status = 400,
): asserts value {
  if (!value) throw new HttpError(status, message);
}
const now = () => new Date().toISOString();
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export function summary(profile?: RecordData) {
  return profile
    ? {
        id: profile.id,
        gamer_tag: profile.gamer_tag,
        username: profile.username,
        avatar: profile.avatar || null,
      }
    : { gamer_tag: "GGz", avatar: null };
}
export async function ensureProfile(
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    username?: string | null;
  },
  tag?: string,
) {
  return atomic(async (db) => {
    const profiles = await list("profile", db);
    const existing = profiles.find((p) => p.user_id === user.id);
    if (existing) return existing;
    const base = (tag || user.name).trim().slice(0, 45) || "Player";
    let gamerTag = base;
    for (
      let i = 1;
      profiles.some(
        (p) => p.gamer_tag.toLowerCase() === gamerTag.toLowerCase(),
      );
      i++
    )
      gamerTag = `${base}${i}`;
    return insert(
      "profile",
      {
        user_id: user.id,
        username: user.username || user.name,
        gamer_tag: gamerTag,
        avatar: user.image || null,
        cover: null,
        bio: "",
        location: "",
        city: "",
        country: "Zimbabwe",
        location_public: false,
        platform: "PC",
        rank: "Unranked",
        availability: "Available",
        respect_points: 0,
        tournament_wins: 0,
        matches_played: 0,
        match_wins: 0,
        games: [],
        followers: [],
        following: [],
        friends: [],
        blocked: [],
        respected_by: [],
        presence: "offline",
        show_online_status: false,
        show_last_seen: false,
        created_at: now(),
      },
      db,
    );
  });
}
export function publicProfile(p: RecordData, viewer?: RecordData): RecordData {
  const { user_id, blocked, respected_by, friend_requests, wishlist, ...safe } =
    p;
  void user_id;
  void blocked;
  void respected_by;
  void friend_requests;
  void wishlist;
  return {
    ...safe,
    location:
      p.location_public || p.id === viewer?.id ? p.location : "Zimbabwe",
    city: p.location_public ? p.city : "",
    latitude: undefined,
    longitude: undefined,
    presence:
      p.show_online_status || p.id === viewer?.id ? p.presence : "offline",
    respect_level: p.respect_points >= 100 ? "Veteran" : "Rookie",
    win_percentage: p.matches_played
      ? Math.round((p.match_wins / p.matches_played) * 100)
      : 0,
    follower_count: p.followers.length,
    following_count: p.following.length,
    game_count: p.games.length,
    is_following: p.followers.includes(viewer?.id),
    is_friend: p.friends.includes(viewer?.id),
    is_self: p.id === viewer?.id,
    has_friend_request: Boolean(viewer?.friend_requests?.includes(p.id)),
    followers: undefined,
    following: undefined,
    friends: undefined,
  };
}
async function notify(
  recipient: number,
  actor: RecordData,
  message: string,
  target_url: string,
  db: Database,
) {
  if (recipient !== actor.id)
    await insert(
      "notification",
      {
        recipient,
        actor: summary(actor),
        message,
        target_url,
        notification_type: "Community",
        is_read: false,
        created_at: now(),
      },
      db,
    );
}
export async function publicList(
  kind: string,
  viewer?: RecordData,
  db?: Database,
): Promise<RecordData[]> {
  const entries = (await list(kind, db)).filter(
    (e) => !e.hidden && !e.suspended_at,
  );
  if (kind === "profile")
    return entries
      .filter(
        (p) =>
          !p.blocked.includes(viewer?.id) && !viewer?.blocked.includes(p.id),
      )
      .map((p) => publicProfile(p, viewer));
  if (kind === "tournament" || kind === "event")
    return entries.filter(
      (e) => e.status !== "Draft" || e.organizer_id === viewer?.id,
    );
  if (kind === "listing")
    return entries.filter(
      (e) =>
        ["Available", "Reserved"].includes(e.status) ||
        e.seller_id === viewer?.id,
    );
  if (kind === "post") {
    const profiles = await list("profile", db);
    return entries
      .filter(
        (p) =>
          !viewer?.blocked.includes(p.author.id) &&
          profiles.some(
            (a) =>
              a.id === p.author.id &&
              !a.hidden &&
              !a.suspended_at &&
              !a.blocked.includes(viewer?.id),
          ) &&
          (p.visibility !== "Private" || p.author.id === viewer?.id),
      )
      .map((p) => ({
        ...p,
        liked: p.likes.includes(viewer?.id),
        saved: p.saves.includes(viewer?.id),
        like_count: p.likes.length,
        comment_count: p.comments.length,
        likes: undefined,
        saves: undefined,
      }));
  }
  return entries;
}

const text = (max = 200) => z.string().trim().min(1).max(max);
const tournamentSchema = z.object({
  name: text(120),
  description: text(5000),
  game: z.coerce.number().int().positive(),
  start_date: z.iso.datetime({ offset: true }),
  registration_deadline: z.iso.datetime({ offset: true }),
  max_participants: z.coerce.number().int().min(2).max(128),
  location: z.string().trim().max(200).default("Online"),
  mode: z.enum(["Online", "In Person", "Hybrid"]).default("Online"),
  rules: text(5000),
  prize_description: z.string().max(500).default(""),
  status: z.enum(["Draft", "Open"]).default("Draft"),
});
const eventSchema = z.object({
  organization_id: z.coerce.number().int().positive().optional(),
  name: text(120),
  description: text(5000),
  start_date: z.iso.datetime({ offset: true }),
  location: text(200),
  city: z.string().max(100).default(""),
  capacity: z.coerce.number().int().min(1).max(5000),
  mode: z.enum(["Online", "In Person", "Hybrid"]).default("In Person"),
  status: z.enum(["Draft", "Published"]).default("Draft"),
});
const listingSchema = z.object({
  title: text(120),
  description: text(5000),
  category: z.enum([
    "Consoles",
    "Controllers",
    "Headsets",
    "Monitors",
    "Keyboards",
    "Mice",
    "Games",
    "Accessories",
    "Other",
  ]),
  price: z.coerce.number().positive().max(100000),
  condition: z.enum(["New", "Like New", "Good", "Fair", "Poor"]),
  location: text(200),
  platform: z.string().max(50).default(""),
  image: z.string().url().optional(),
});

export async function readPlatform(
  path: string[],
  query: URLSearchParams,
  viewer?: RecordData,
): Promise<unknown> {
  const [area, key, action] = path;
  const managed = await readManagement(path, query, viewer);
  if (managed) return managed.value;
  if (area === "profiles" && key === "edit") {
    check(viewer, "Please log in.", 401);
    return {
      bio: viewer.bio,
      location: viewer.location,
      platform: viewer.platform,
      availability: viewer.availability,
      location_public: viewer.location_public,
    };
  }
  const map: Record<string, string> = {
    games: "game",
    tournaments: "tournament",
    events: "event",
    teams: "team",
    marketplace: "listing",
    feed: "post",
  };
  if (area === "profiles" && key === "gamers")
    return publicList("profile", viewer);
  if (area === "profiles" && key === "detail") {
    const p = (await list("profile")).find(
      (p) => p.gamer_tag.toLowerCase() === action?.toLowerCase(),
    );
    check(
      p &&
        !p.hidden &&
        !p.suspended_at &&
        !p.blocked.includes(viewer?.id) &&
        !viewer?.blocked.includes(p.id),
      "Profile not found.",
      404,
    );
    return {
      ...publicProfile(p, viewer),
      games: (await list("game")).filter((g) => p.games.includes(g.id)),
    };
  }
  if (area === "search") {
    const term = (query.get("q") || "").trim().toLowerCase();
    const result: Record<string, unknown> = {};
    for (const [name, kind] of Object.entries({
      games: "game",
      gamers: "profile",
      teams: "team",
      tournaments: "tournament",
      events: "event",
    }))
      result[name] = term
        ? (await publicList(kind, viewer))
            .filter((row) =>
              `${row.name || row.gamer_tag} ${row.description || ""}`
                .toLowerCase()
                .includes(term),
            )
            .slice(0, 30)
        : [];
    return result;
  }
  if (area === "radar") {
    const q = (query.get("q") || "").toLowerCase();
    const managed = await readManagement(["venues"], query, undefined);
    const standalone = (await list("standalone_venue"))
      .filter((v) => v.public_visible && !v.hidden)
      .map(
        (v): RecordData => ({
          ...v,
          kind: "venue",
          url: `/venues/standalone-${v.id}`,
        }),
      );
    const venues = [
      ...((managed?.value as RecordData[]) ?? []).filter(
        (v) => v.public_visible,
      ),
      ...standalone,
    ].filter(
      (v) =>
        `${v.name} ${v.city} ${v.address}`.toLowerCase().includes(q) &&
        Number.isFinite(v.latitude) &&
        Number.isFinite(v.longitude),
    );
    return {
      hotspots: [],
      venues,
      locations: [],
      events: [],
      tournaments: [],
      organizations: [],
    };
  }
  if (area === "leaderboards")
    return (await publicList("profile", viewer))
      .sort((a, b) => b.respect_points - a.respect_points)
      .map((p, i) => ({
        ...p,
        rank: i + 1,
        wins: p.match_wins,
        matches: p.matches_played,
      }));
  if (area === "notifications") {
    check(viewer, "Please log in.", 401);
    return (await list("notification"))
      .filter((n) => n.recipient === viewer.id)
      .reverse();
  }
  if (area === "security") {
    check(viewer, "Please log in.", 401);
    if (key === "export")
      return {
        profile: viewer,
        posts: (await list("post")).filter((p) => p.author.id === viewer.id),
        exported_at: now(),
      };
    return {
      username: viewer.username,
      providers: [],
      presence: {
        show_online_status: viewer.show_online_status,
        show_last_seen: viewer.show_last_seen,
      },
    };
  }
  if (area === "messages") {
    check(viewer, "Please log in.", 401);
    const conversations = (await list("conversation")).filter((c) =>
      c.participants.includes(viewer.id),
    );
    const profiles = await list("profile");
    const data: RecordData[] = conversations.map((c) => ({
      ...c,
      other_participant: summary(
        profiles.find(
          (p) => c.participants.includes(p.id) && p.id !== viewer.id,
        ),
      ),
      last_message: c.messages.at(-1)?.content || "",
      last_message_time: c.updated_at,
      unread_count: c.messages.filter(
        (m: RecordData) =>
          m.sender_id !== viewer.id && !m.read_by.includes(viewer.id),
      ).length,
    }));
    if (!key) return data.reverse();
    const conversation = data.find((c) => String(c.id) === key);
    check(conversation, "Conversation not found.", 404);
    return {
      ...conversation,
      messages: conversation.messages.map((m: RecordData) => ({
        ...m,
        sender:
          profiles.find((p) => p.id === m.sender_id)?.gamer_tag || "Player",
      })),
    };
  }
  const kind = map[area];
  check(kind, "Route not found.", 404);
  if (area === "feed") check(viewer, "Please log in.", 401);
  const rows = await publicList(kind, viewer);
  const id = area === "feed" && key === "posts" ? action : key;
  if (!id) {
    return rows.filter(
      (row) =>
        (!query.get("category") || row.category === query.get("category")) &&
        (!query.get("condition") || row.condition === query.get("condition")),
    );
  }
  const entity = rows.find((row) => String(row.id) === id || row.slug === id);
  check(entity, "Not found.", 404);
  if (kind === "game") {
    const reviews = (await list("review")).filter(
      (r) => r.game_id === entity.id,
    );
    const players = (await publicList("profile", viewer)).filter((p) =>
      p.games.includes(entity.id),
    );
    return {
      ...entity,
      in_library: Boolean(viewer?.games.includes(entity.id)),
      reviews,
      review_count: reviews.length,
      average_rating: reviews.length
        ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length
        : null,
      user_review: reviews.find((r) => r.author_id === viewer?.id) || null,
      is_wishlisted: (viewer?.wishlist || []).includes(entity.id),
      wishlist_count: (await list("profile")).filter((p) =>
        p.wishlist?.includes(entity.id),
      ).length,
      leaderboard: await rankings(entity.id),
      available_players: players,
      challengers: players.filter((p) => p.id !== viewer?.id),
      community_posts: (await publicList("post", viewer)).filter(
        (p) => p.game_id === entity.id,
      ),
      upcoming_tournaments: (await publicList("tournament", viewer)).filter(
        (t) => t.game_id === entity.id,
      ),
      related_events: [],
      related_listings: [],
      game_news: [],
      player_count_total: players.length,
      tournament_count: 0,
      event_count: 0,
    };
  }
  if (kind === "tournament")
    return {
      ...entity,
      is_organizer: entity.organizer_id === viewer?.id,
      registration_status: entity.participants.some(
        (p: RecordData) => p.id === viewer?.id,
      )
        ? "Registered"
        : null,
    };
  if (kind === "event")
    return {
      ...entity,
      is_organizer: entity.organizer_id === viewer?.id,
      is_rsvped: entity.attendees.some((p: RecordData) => p.id === viewer?.id),
      spots_remaining:
        entity.capacity == null
          ? null
          : Math.max(0, entity.capacity - entity.attendees.length),
    };
  if (kind === "team")
    return {
      ...entity,
      is_manager: entity.owner_id === viewer?.id,
      is_member: entity.roster.some((p: RecordData) => p.id === viewer?.id),
    };
  if (kind === "listing")
    return {
      ...entity,
      is_owner: entity.seller_id === viewer?.id,
      is_saved: entity.saves.includes(viewer?.id),
      saves: undefined,
      save_count: entity.saves.length,
    };
  return entity;
}

export async function mutatePlatform(
  path: string[],
  body: Record<string, unknown>,
  viewer: RecordData,
): Promise<unknown> {
  return atomic(async (db) => {
    // Re-read the current profile inside the write transaction to prevent stale updates.
    const actor = await find("profile", viewer.id, db);
    check(actor, "Profile not found.", 404);
    check(
      !actor.suspended_at,
      "This account is suspended. Contact GGz support.",
      403,
    );
    const window = Math.floor(Date.now() / 60000);
    const limited = await sql<{
      count: number;
    }>`insert into ggz_write_limit(subject,window_index,count) values(${actor.user_id},${window},1) on conflict(subject) do update set window_index=excluded.window_index,count=case when ggz_write_limit.window_index=excluded.window_index then ggz_write_limit.count+1 else 1 end returning count`.execute(
      db,
    );
    check(
      limited.rows[0].count <= 90,
      "Too many actions. Please wait a minute.",
      429,
    );
    const managed = await mutateManagement(path, body, actor, db);
    if (managed) return managed.value;
    const [area, key, action, fourth] = path;
    if (area === "security" && key === "presence") {
      actor.show_online_status =
        body.show_online_status === true || body.show_online_status === "true";
      actor.show_last_seen =
        body.show_last_seen === true || body.show_last_seen === "true";
      await save("profile", actor, db);
      return { ok: true };
    }
    if (area === "profiles" && key === "edit") {
      const input = z
        .object({
          bio: z.string().trim().max(1000),
          location: z.string().trim().max(100),
          platform: z.enum(["PC", "PlayStation", "Xbox", "Nintendo", "Mobile"]),
          availability: z.enum(["Available", "Sometimes", "Busy"]),
          location_public: z.boolean().default(false),
        })
        .parse(body);
      return save("profile", { ...actor, ...input }, db);
    }
    if (area === "profiles") {
      const target = (await list("profile", db)).find(
        (p) => p.gamer_tag === key,
      );
      check(target && target.id !== actor.id, "Choose another player.");
      if (action === "block" || action === "unblock") {
        actor.blocked = actor.blocked.filter((id: number) => id !== target.id);
        if (action === "block") actor.blocked.push(target.id);
      } else {
        check(
          !target.blocked.includes(actor.id) &&
            !actor.blocked.includes(target.id),
          "This connection is unavailable.",
          403,
        );
        if (action === "follow" || action === "unfollow") {
          actor.following = actor.following.filter(
            (id: number) => id !== target.id,
          );
          target.followers = target.followers.filter(
            (id: number) => id !== actor.id,
          );
          if (action === "follow") {
            actor.following.push(target.id);
            target.followers.push(actor.id);
            await notify(
              target.id,
              actor,
              `${actor.gamer_tag} followed you.`,
              `/profiles/${actor.gamer_tag}`,
              db,
            );
          }
        } else if (action === "respect") {
          check(
            !target.respected_by.includes(actor.id),
            "You already sent respect to this player.",
          );
          target.respected_by.push(actor.id);
          target.respect_points++;
        } else if (action === "friend") {
          target.friend_requests ??= [];
          if (!target.friend_requests.includes(actor.id))
            target.friend_requests.push(actor.id);
          await notify(
            target.id,
            actor,
            `${actor.gamer_tag} sent a friend request.`,
            `/profiles/${actor.gamer_tag}`,
            db,
          );
        } else if (action === "accept") {
          check(
            actor.friend_requests?.includes(target.id),
            "Friend request not found.",
            404,
          );
          actor.friend_requests = actor.friend_requests.filter(
            (id: number) => id !== target.id,
          );
          if (!actor.friends.includes(target.id)) actor.friends.push(target.id);
          if (!target.friends.includes(actor.id)) target.friends.push(actor.id);
        } else throw new HttpError(404, "Action not found.");
      }
      await save("profile", target, db);
      await save("profile", actor, db);
      return { ok: true };
    }
    if (area === "notifications") {
      for (const n of await list("notification", db))
        if (
          n.recipient === actor.id &&
          (key === "mark-all-read" || String(n.id) === key)
        )
          await save("notification", { ...n, is_read: true }, db);
      return { ok: true };
    }
    if (area === "teams" && key !== "create") {
      const team = await find("team", key, db);
      check(team, "Team not found.", 404);
      if (action === "join") {
        check(team.status === "Recruiting", "This team is not recruiting.");
        check(
          !team.roster.some((p: RecordData) => p.id === actor.id),
          "You are already a member.",
        );
        team.roster.push({
          ...summary(actor),
          role: "Member",
          is_owner: false,
        });
      } else if (action === "leave") {
        check(
          team.owner_id !== actor.id,
          "The owner must transfer ownership before leaving.",
        );
        team.roster = team.roster.filter((p: RecordData) => p.id !== actor.id);
      } else throw new HttpError(404, "Action not found.");
      team.member_count = team.roster.length;
      await save("team", team, db);
      return { ok: true };
    }
    if (area === "teams" && key === "create") {
      const input = z
        .object({
          name: text(100),
          tag: text(10),
          description: text(2000),
          game: z.coerce.number().int().positive().optional(),
        })
        .parse(body);
      const game = input.game ? await find("game", input.game, db) : undefined;
      const slug = `${slugify(input.name)}-${crypto.randomUUID().slice(0, 6)}`;
      return insert(
        "team",
        {
          ...input,
          slug,
          owner_id: actor.id,
          owner_gamer_tag: actor.gamer_tag,
          game_name: game?.name || null,
          roster: [{ ...summary(actor), role: "Captain", is_owner: true }],
          member_count: 1,
          wins: 0,
          losses: 0,
          matches_played: 0,
          win_rate: 0,
          status: "Recruiting",
          location: actor.location,
          created_at: now(),
        },
        db,
      );
    }
    if (
      ["tournaments", "events", "marketplace"].includes(area) &&
      key === "create"
    ) {
      if (area === "tournaments") {
        const input = tournamentSchema.parse(body);
        check(
          new Date(input.start_date).getTime() > Date.now(),
          "Start date must be in the future.",
        );
        check(
          new Date(input.registration_deadline) <= new Date(input.start_date),
          "Registration must close before the tournament starts.",
        );
        const game = await find("game", input.game, db);
        check(game, "Select a valid game.");
        return insert(
          "tournament",
          {
            ...input,
            game_id: game.id,
            game_name: game.name,
            slug: `${slugify(input.name)}-${crypto.randomUUID().slice(0, 6)}`,
            format: "Single Elimination",
            entry_type: "Free",
            organizer_id: actor.id,
            organizer: summary(actor),
            organizer_name: actor.gamer_tag,
            participants: [],
            participant_count: 0,
            matches: [],
            created_at: now(),
          },
          db,
        );
      }
      if (area === "events") {
        const input = eventSchema.parse(body);
        check(
          new Date(input.start_date).getTime() > Date.now(),
          "Start date must be in the future.",
        );
        const organization = input.organization_id
          ? await find("organization", input.organization_id, db)
          : undefined;
        if (input.organization_id)
          check(
            organization?.owner_id === actor.id,
            "Only an organization owner can publish on its behalf.",
            403,
          );
        return insert(
          "event",
          {
            ...input,
            organization_name: organization?.name ?? null,
            organizer_id: actor.id,
            organizer: summary(actor),
            organizer_name: actor.gamer_tag,
            attendees: [],
            rsvp_count: 0,
            created_at: now(),
          },
          db,
        );
      }
      const input = listingSchema.parse(body);
      if (input.image)
        check(
          process.env.MEDIA_PUBLIC_URL &&
            input.image.startsWith(
              process.env.MEDIA_PUBLIC_URL.replace(/\/$/, "") + "/uploads/",
            ),
          "Please upload a valid listing photo.",
        );
      return insert(
        "listing",
        {
          ...input,
          price: input.price.toFixed(2),
          images: input.image ? [input.image] : [],
          seller_id: actor.id,
          seller: summary(actor),
          seller_name: actor.gamer_tag,
          seller_avatar: actor.avatar,
          status: "Available",
          saves: [],
          save_count: 0,
          created_at: now(),
        },
        db,
      );
    }
    if (area === "tournaments" || area === "events") {
      const kind = area === "tournaments" ? "tournament" : "event";
      const item = await find(kind, key, db);
      check(item, "Not found.", 404);
      const field = kind === "tournament" ? "participants" : "attendees";
      if (action === "register" || action === "rsvp") {
        check(
          ["Open", "Published"].includes(item.status),
          "Registration is closed.",
        );
        check(
          new Date(item.registration_deadline || item.start_date).getTime() >
            Date.now(),
          "Registration deadline has passed.",
        );
        check(
          !item[field].some((p: RecordData) => p.id === actor.id),
          "You are already registered.",
        );
        check(
          (item.max_participants || item.capacity) == null ||
            item[field].length < (item.max_participants || item.capacity),
          "This event is full.",
        );
        item[field].push({ ...summary(actor), status: "Registered" });
      } else if (action === "leave") {
        check(
          !["Live", "Completed"].includes(item.status),
          "Registration is locked while matches are underway.",
        );
        item[field] = item[field].filter((p: RecordData) => p.id !== actor.id);
      } else {
        check(
          item.organizer_id === actor.id,
          "Only the organizer can manage this event.",
          403,
        );
        if (action === "publish") {
          check(item.status === "Draft", "Only drafts can be published.");
          item.status = kind === "tournament" ? "Open" : "Published";
        } else if (action === "cancel") {
          check(
            item.status !== "Completed",
            "Completed events cannot be cancelled.",
          );
          item.status = "Cancelled";
        } else if (action === "bracket") {
          check(
            kind === "tournament" &&
              item.status === "Open" &&
              item.participants.length >= 2 &&
              item.matches.length === 0,
            "At least two players and an unstarted tournament are required.",
          );
          const players = [...item.participants];
          // Randomize once under the same transaction that closes registration.
          for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
          }
          let size = 2;
          while (size < players.length) size *= 2;
          item.matches = [];
          for (let i = 0; i < size / 2; i++)
            item.matches.push({
              id: i + 1,
              round: 1,
              player_one: players[i].gamer_tag,
              player_two: players[i + size / 2]?.gamer_tag || null,
              winner: players[i + size / 2] ? null : players[i].gamer_tag,
              score: "",
              status: players[i + size / 2] ? "Scheduled" : "Completed",
            });
          item.status = "Live";
        } else if (action === "result") {
          check(
            kind === "tournament" && item.status === "Live",
            "Tournament is not live.",
          );
          const match = item.matches.find(
            (m: RecordData) => m.id === Number(body.match_id),
          );
          check(
            match &&
              !match.winner &&
              [match.player_one, match.player_two].includes(body.winner) &&
              body.winner,
            "Choose a valid player in an unfinished match.",
          );
          match.winner = body.winner;
          match.score = text(50).parse(body.score);
          match.status = "Completed";
          for (const tag of [match.player_one, match.player_two]) {
            const p = (await list("profile", db)).find(
              (p) => p.gamer_tag === tag,
            );
            if (p) {
              p.matches_played++;
              if (tag === match.winner) p.match_wins++;
              await save("profile", p, db);
            }
          }
          const round = item.matches.filter(
            (m: RecordData) => m.round === match.round,
          );
          if (round.every((m: RecordData) => m.winner)) {
            if (round.length === 1) {
              item.status = "Completed";
              item.winner = round[0].winner;
              for (const participant of item.participants) {
                const p = await find("profile", participant.id, db);
                if (p) {
                  if (p.gamer_tag === item.winner) {
                    p.tournament_wins++;
                  }
                  await save("profile", p, db);
                }
              }
            } else
              for (let i = 0; i < round.length; i += 2)
                item.matches.push({
                  id: item.matches.length + 1,
                  round: match.round + 1,
                  player_one: round[i].winner,
                  player_two: round[i + 1].winner,
                  winner: null,
                  score: "",
                  status: "Scheduled",
                });
          }
        } else throw new HttpError(404, "Action not found.");
      }
      item.participant_count = item.participants?.length || 0;
      item.rsvp_count = item.attendees?.length || 0;
      await save(kind, item, db);
      return { ok: true, message: "Updated successfully." };
    }
    if (area === "feed") {
      if (key === "create") {
        const content = text(5000).parse(body.body || body.content);
        const game = body.game
          ? await find("game", String(body.game), db)
          : undefined;
        return insert(
          "post",
          {
            content,
            author: summary(actor),
            game: game?.name || null,
            game_id: game?.id || null,
            image:
              typeof body.image === "string" &&
              body.image.startsWith(
                process.env.MEDIA_PUBLIC_URL || "https://invalid.invalid/",
              )
                ? body.image
                : null,
            visibility: "Public",
            likes: [],
            saves: [],
            comments: [],
            created_at: now(),
          },
          db,
        );
      }
      const post = await find("post", action, db);
      check(
        post &&
          (await publicList("post", actor, db)).some((p) => p.id === post.id),
        "Post not found.",
        404,
      );
      check(!actor.blocked.includes(post.author.id), "Post unavailable.", 403);
      if (fourth === "comments") {
        const bodyText = text(2000).parse(body.body || body.content);
        post.comments.push({
          id: post.comments.length + 1,
          author: summary(actor),
          body: bodyText,
          created_at: now(),
        });
      } else if (fourth === "like" || fourth === "save") {
        const field = fourth === "like" ? "likes" : "saves";
        post[field] = post[field].includes(actor.id)
          ? post[field].filter((id: number) => id !== actor.id)
          : [...post[field], actor.id];
      } else if (fourth === "report") {
        await insert(
          "report",
          {
            reporter_id: actor.id,
            target_type: "post",
            target_id: post.id,
            reason: String(body.reason || "Community report").slice(0, 2000),
            created_at: now(),
          },
          db,
        );
      } else throw new HttpError(404, "Action not found.");
      await save("post", post, db);
      return {
        ok: true,
        liked: post.likes.includes(actor.id),
        saved: post.saves.includes(actor.id),
        like_count: post.likes.length,
        comment_count: post.comments.length,
      };
    }
    if (area === "games") {
      const game = await find("game", key, db);
      check(game, "Game not found.", 404);
      if (action === "reviews") {
        const input = z
          .object({
            rating: z.coerce.number().int().min(1).max(5),
            review: z.string().trim().max(3000).default(""),
          })
          .parse(body);
        const existing = (await list("review", db)).find(
          (r) => r.author_id === actor.id && r.game_id === game.id,
        );
        const review = {
          ...input,
          game_id: game.id,
          author_id: actor.id,
          reviewer: summary(actor),
          created_at: now(),
        };
        if (existing) await save("review", { ...review, id: existing.id }, db);
        else await insert("review", review, db);
      } else if (action === "wishlist") {
        actor.wishlist ??= [];
        actor.wishlist = actor.wishlist.includes(game.id)
          ? actor.wishlist.filter((id: number) => id !== game.id)
          : [...actor.wishlist, game.id];
        await save("profile", actor, db);
        return { ok: true, is_wishlisted: actor.wishlist.includes(game.id) };
      } else if (action === "challenge") {
        const opponent = (await list("profile", db)).find(
          (p) =>
            String(p.id) === String(body.opponent) ||
            p.gamer_tag === body.opponent,
        );
        check(opponent && opponent.id !== actor.id, "Choose another player.");
        check(
          !opponent.blocked.includes(actor.id) &&
            !actor.blocked.includes(opponent.id),
          "Player unavailable.",
          403,
        );
        await notify(
          opponent.id,
          actor,
          `${actor.gamer_tag} challenged you to ${game.name}.`,
          `/games/${game.id}`,
          db,
        );
      } else throw new HttpError(404, "Action not found.");
      return { ok: true };
    }
    if (area === "marketplace") {
      const listing = await find("listing", key, db);
      check(listing && !listing.hidden, "Listing not found.", 404);
      if (action === "save") {
        listing.saves = listing.saves.includes(actor.id)
          ? listing.saves.filter((id: number) => id !== actor.id)
          : [...listing.saves, actor.id];
        await save("listing", listing, db);
        return {
          ok: true,
          is_saved: listing.saves.includes(actor.id),
          save_count: listing.saves.length,
        };
      }
      if (action === "report") {
        await insert(
          "report",
          {
            reporter_id: actor.id,
            target_type: "listing",
            target_id: listing.id,
            reason: String(body.reason || "Listing report").slice(0, 2000),
            created_at: now(),
          },
          db,
        );
        return { ok: true };
      }
      if (action === "sold") {
        check(
          listing.seller_id === actor.id,
          "Only the seller can mark this sold.",
          403,
        );
        listing.status = "Sold";
        await save("listing", listing, db);
        return { ok: true };
      }
      if (action === "contact")
        return startConversation(actor, listing.seller_id, db);
      throw new HttpError(404, "Action not found.");
    }
    if (area === "messages") {
      if (key === "start") {
        const other = (await list("profile", db)).find(
          (p) => p.gamer_tag === action,
        );
        check(other, "Player not found.", 404);
        return startConversation(actor, other.id, db);
      }
      const conversation = await find("conversation", key, db);
      check(
        conversation && conversation.participants.includes(actor.id),
        "Conversation not found.",
        404,
      );
      const other = await find(
        "profile",
        conversation.participants.find((id: number) => id !== actor.id),
        db,
      );
      check(
        other &&
          !other.blocked.includes(actor.id) &&
          !actor.blocked.includes(other.id),
        "Conversation unavailable.",
        403,
      );
      if (action === "read") {
        for (const message of conversation.messages)
          if (!message.read_by.includes(actor.id))
            message.read_by.push(actor.id);
        await save("conversation", conversation, db);
        return { ok: true };
      }
      if (action === "send") {
        const content = text(4000).parse(body.content || body.body);
        const message = {
          id: conversation.messages.length + 1,
          sender_id: actor.id,
          sender: actor.gamer_tag,
          content,
          created_at: now(),
          read_by: [actor.id],
        };
        conversation.messages.push(message);
        conversation.updated_at = now();
        await save("conversation", conversation, db);
        await notify(
          other.id,
          actor,
          `${actor.gamer_tag} sent you a message.`,
          "/messages",
          db,
        );
        return { ...message, ok: true };
      }
      throw new HttpError(404, "Action not found.");
    }
    throw new HttpError(404, "Route not found.");
  });
}
async function startConversation(
  actor: RecordData,
  otherId: number,
  db: Database,
) {
  const other = await find("profile", otherId, db);
  check(other && other.id !== actor.id, "Choose another player.");
  check(
    !other.blocked.includes(actor.id) && !actor.blocked.includes(other.id),
    "Conversation unavailable.",
    403,
  );
  let conversation = (await list("conversation", db)).find(
    (c) =>
      c.participants.length === 2 &&
      c.participants.includes(actor.id) &&
      c.participants.includes(other.id),
  );
  if (!conversation && !actor.friends.includes(other.id)) {
    const existing = (await list("message_request", db)).find(
      (r) => r.sender_id === actor.id && r.recipient_id === other.id,
    );
    check(
      existing?.status !== "Declined",
      "This player declined your message request.",
      403,
    );
    if (!existing) {
      await insert(
        "message_request",
        {
          sender_id: actor.id,
          sender: summary(actor),
          recipient_id: other.id,
          recipient: summary(other),
          status: "Pending",
          created_at: now(),
        },
        db,
      );
      await notify(
        other.id,
        actor,
        `${actor.gamer_tag} wants to message you.`,
        "/invitations",
        db,
      );
    }
    return {
      ok: true,
      message:
        "Message request sent. The player must accept before you can chat.",
    };
  }
  conversation ??= await insert(
    "conversation",
    { participants: [actor.id, other.id], messages: [], updated_at: now() },
    db,
  );
  return { ok: true, conversation_id: conversation.id };
}
