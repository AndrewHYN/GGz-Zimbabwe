import { z } from "zod";
import { sql } from "kysely";
import { find, insert, list, save, type Database, type RecordData } from "./db";
import { check, publicProfile, summary } from "./platform";
const now = () => new Date().toISOString();
const text = (n = 200) => z.string().trim().min(1).max(n);
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") +
  "-" +
  crypto.randomUUID().slice(0, 6);
const website = z
  .union([
    z.literal(""),
    z
      .url()
      .refine((s) => /^https?:\/\//.test(s), "Use an http or https website."),
  ])
  .default("");
const organizationSchema = z.object({
  name: text(160),
  description: text(3000),
  organization_type: z.enum([
    "Organization",
    "Brand",
    "Venue",
    "Team",
    "Community",
  ]),
  website,
  city: z.string().trim().max(120).default(""),
});
const venueSchema = z.object({
  name: text(180),
  description: text(3000),
  city: text(120),
  address: text(255),
  category: z.string().trim().max(60).default("Gaming Hub"),
  latitude: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().finite().min(-90).max(90),
  ),
  longitude: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().finite().min(-180).max(180),
  ),
  public_visible: z.boolean().default(false),
  phone: z.string().max(30).default(""),
  opening_hours: z.string().max(250).default(""),
  website,
});
export async function staffRole(actor: RecordData | undefined, db?: Database) {
  if (!actor) return null;
  const { database } = await import("./db");
  const rows = await sql<{
    role: string;
  }>`select role from ggz_staff where user_id=${actor.user_id}`.execute(
    db ?? (await database()),
  );
  return rows.rows[0]?.role ?? null;
}
async function notification(
  to: number,
  actor: RecordData,
  message: string,
  url: string,
  db: Database,
) {
  if (to !== actor.id)
    await insert(
      "notification",
      {
        recipient: to,
        actor: summary(actor),
        message,
        target_url: url,
        notification_type: "Community",
        is_read: false,
        created_at: now(),
      },
      db,
    );
}
export async function rankings(gameId?: number, db?: Database) {
  const profiles = (await list("profile", db)).filter(
    (p) => !p.suspended_at && !p.hidden,
  );
  const matches: RecordData[] = [];
  for (const t of await list("tournament", db))
    if (!gameId || t.game_id === gameId)
      for (const m of t.matches ?? [])
        if (
          m.status === "Completed" &&
          m.player_one &&
          m.player_two &&
          m.winner
        )
          matches.push(m);
  for (const c of await list("challenge", db))
    if (c.status === "Completed" && (!gameId || c.game_id === gameId))
      matches.push({
        id: c.id,
        player_one: c.challenger.gamer_tag,
        player_two: c.opponent.gamer_tag,
        winner: c.result.winner,
      });
  return profiles
    .map((p): RecordData => {
      const played = matches.filter((m) =>
        [m.player_one, m.player_two].includes(p.gamer_tag),
      );
      const wins = played.filter((m) => m.winner === p.gamer_tag).length;
      return {
        ...publicProfile(p),
        rank_label: p.rank,
        wins,
        matches: played.length,
        win_percentage: played.length
          ? Math.round((100 * wins) / played.length)
          : 0,
      };
    })
    .filter((p) => !gameId || p.matches > 0)
    .sort((a, b) =>
      gameId
        ? b.wins - a.wins ||
          b.win_percentage - a.win_percentage ||
          a.gamer_tag.localeCompare(b.gamer_tag)
        : b.respect_points - a.respect_points ||
          a.gamer_tag.localeCompare(b.gamer_tag),
    )
    .map((p, i) => ({ ...p, rank: i + 1 }));
}
function cleanOrg(org: RecordData, owner = false) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    description: org.description,
    organization_type: org.organization_type,
    website: org.website,
    city: org.city,
    verification_status: org.verification_status,
    is_owner: owner,
    hidden: owner ? Boolean(org.hidden) : undefined,
  };
}
function cleanVenue(v: RecordData, owner = false) {
  const reviews = (v.reviews ?? []).filter((r: RecordData) => !r.hidden);
  return {
    id: v.id,
    name: v.name,
    description: v.description,
    organization_id: v.organization_id,
    organization_name: v.organization_name,
    city: v.city,
    address: v.address,
    location: v.address,
    category: v.category,
    latitude: v.latitude,
    longitude: v.longitude,
    phone: v.phone,
    website: v.website,
    opening_hours: v.opening_hours,
    public_visible: v.public_visible,
    verification_status: v.verification_status,
    is_owner: owner,
    kind: "venue",
    url: `/venues/${v.id}`,
    reviews,
    rating_count: reviews.length,
    rating_average: reviews.length
      ? reviews.reduce((n: number, r: RecordData) => n + r.rating, 0) /
        reviews.length
      : null,
  };
}
export async function readManagement(
  path: string[],
  query: URLSearchParams,
  viewer?: RecordData,
): Promise<{ value: unknown } | undefined> {
  const [area, key] = path;
  if (area === "leaderboards")
    return {
      value: await rankings(
        query.get("game") ? Number(query.get("game")) : undefined,
      ),
    };
  if (area === "message-requests") {
    check(viewer, "Please log in.", 401);
    return {
      value: (await list("message_request"))
        .filter(
          (r) => r.recipient_id === viewer.id || r.sender_id === viewer.id,
        )
        .map((r) => ({ ...r, is_recipient: r.recipient_id === viewer.id })),
    };
  }
  if (area === "invitations") {
    check(viewer, "Please log in.", 401);
    const regular = await list("invitation");
    const tournaments = (await list("tournament_invitation")).map((i) => ({
      ...i,
      id: `tournament-${i.id}`,
      recipient_id: i.recipient_id,
      actor_id: i.actor_id,
      type: "tournament",
    }));
    return {
      value: [...regular, ...tournaments]
        .filter((i) => i.recipient_id === viewer.id || i.actor_id === viewer.id)
        .map((i) => ({ ...i, is_recipient: i.recipient_id === viewer.id })),
    };
  }
  if (area === "challenges") {
    check(viewer, "Please log in.", 401);
    const kind = "challenge";
    return {
      value: (await list(kind))
        .filter((i) => [i.challenger.id, i.opponent.id].includes(viewer.id))
        .map((i) => ({
          ...i,
          is_recipient: i.opponent.id === viewer.id,
          is_challenger: kind === "challenge" && i.challenger.id === viewer.id,
          can_confirm: i.result && i.result.proposed_by !== viewer.id,
          is_proposer: i.result?.proposed_by === viewer.id,
        })),
    };
  }
  if (area === "team-management") {
    check(viewer, "Please log in.", 401);
    const team = await find("team", key);
    check(team, "Team not found.", 404);
    check(
      team.owner_id === viewer.id,
      "Only the owner can manage the team.",
      403,
    );
    return {
      value: {
        ...team,
        invitations: (await list("invitation")).filter(
          (i) => i.team_id === team.id,
        ),
        players: (await list("profile"))
          .filter(
            (p) =>
              !p.suspended_at &&
              !p.blocked.includes(viewer.id) &&
              !viewer.blocked.includes(p.id),
          )
          .map(summary),
      },
    };
  }
  if (area === "organizations") {
    const all = await list("organization");
    const rows = all.filter(
      (o) =>
        (!o.hidden && o.verification_status !== "Rejected") ||
        o.owner_id === viewer?.id,
    );
    if (!key)
      return { value: rows.map((o) => cleanOrg(o, o.owner_id === viewer?.id)) };
    const o = rows.find((o) => o.slug === key || String(o.id) === key);
    check(o, "Organization not found.", 404);
    const owner = o.owner_id === viewer?.id;
    return {
      value: {
        ...cleanOrg(o, owner),
        venues: (await list("venue"))
          .filter(
            (v) =>
              v.organization_id === o.id &&
              (owner ||
                (v.public_visible &&
                  !v.hidden &&
                  v.verification_status !== "SUSPENDED")),
          )
          .map((v) => cleanVenue(v, owner)),
      },
    };
  }
  if (area === "venues") {
    if (key?.startsWith("standalone-")) {
      const venue = await find("standalone_venue", key.slice(11));
      check(
        venue && venue.public_visible && !venue.hidden,
        "Venue not found.",
        404,
      );
      return { value: cleanVenue(venue) };
    }
    const orgs = await list("organization");
    const visible = (v: RecordData) => {
      const org = orgs.find((o) => o.id === v.organization_id);
      return (
        v.owner_id === viewer?.id ||
        (v.public_visible &&
          !v.hidden &&
          v.verification_status !== "SUSPENDED" &&
          !org?.hidden &&
          org?.verification_status !== "Rejected")
      );
    };
    const venues = (await list("venue")).filter(visible);
    if (!key)
      return {
        value: venues.map((v) => cleanVenue(v, v.owner_id === viewer?.id)),
      };
    const venue = venues.find((v) => String(v.id) === key);
    check(venue, "Venue not found.", 404);
    return { value: cleanVenue(venue, venue.owner_id === viewer?.id) };
  }
  if (area === "admin") {
    const role = await staffRole(viewer);
    check(role, "Staff access required.", 403);
    return {
      value: {
        role,
        reports: (await list("report")).reverse(),
        organizations: (await list("organization")).map((o) => cleanOrg(o)),
        venues: (await list("venue")).map((v) => cleanVenue(v)),
        promotions: await list("promotion"),
        challenges: (await list("challenge")).filter((c) =>
          ["Disputed", "Needs Reconciliation"].includes(c.status),
        ),
        audit: (await list("audit")).reverse().slice(0, 100),
      },
    };
  }
  return undefined;
}
export async function mutateManagement(
  path: string[],
  body: Record<string, unknown>,
  actor: RecordData,
  db: Database,
): Promise<{ value: unknown } | undefined> {
  const [area, key, action] = path;
  if (area === "events" && action === "promotion") {
    const event = await find("event", key, db);
    check(
      event && event.organizer_id === actor.id,
      "Only the organizer can request promotion.",
      403,
    );
    const organization = await find("organization", event.organization_id, db);
    check(
      organization && organization.owner_id === actor.id,
      "Associate an organization you own before requesting promotion.",
    );
    check(
      !["Completed", "Cancelled"].includes(event.status),
      "This event has ended.",
    );
    check(
      !(await list("promotion", db)).some(
        (p) =>
          p.event_id === event.id &&
          ["Pending", "Under Review", "Approved"].includes(p.status),
      ),
      "A promotion request is already open.",
    );
    return {
      value: await insert(
        "promotion",
        {
          event_id: event.id,
          event_name: event.name,
          requesting_organization_id: organization.id,
          campaign_description: text(2000).parse(body.campaign_description),
          status: "Pending",
          created_at: now(),
        },
        db,
      ),
    };
  }
  if (area === "events" && ["edit", "start", "complete"].includes(action)) {
    const e = await find("event", key, db);
    check(
      e && e.organizer_id === actor.id,
      "Only the organizer can manage this event.",
      403,
    );
    if (action === "edit") {
      check(
        ["Draft", "Published", "Upcoming"].includes(e.status),
        "Only upcoming events can be edited.",
      );
      const input = z
        .object({
          name: text(160),
          description: text(3000),
          location: text(200),
          city: z.string().max(120).default(""),
          start_date: z.iso.datetime({ offset: true }),
          capacity: z.coerce.number().int().min(1).max(5000),
          mode: z.enum(["Online", "In Person", "Hybrid"]),
        })
        .parse(body);
      check(
        new Date(input.start_date).getTime() > Date.now(),
        "Choose a future start date.",
      );
      check(
        input.capacity >= e.attendees.length,
        "Capacity cannot be lower than the current guest count.",
      );
      Object.assign(e, input);
    } else if (action === "start") {
      check(
        ["Published", "Upcoming"].includes(e.status),
        "Only a published event can start.",
      );
      e.status = "Live";
    } else {
      check(e.status === "Live", "Start the event before completing it.");
      e.status = "Completed";
    }
    await save("event", e, db);
    return { value: { ok: true } };
  }
  if (area === "organizations") {
    if (key === "create") {
      const input = organizationSchema.parse(body);
      return {
        value: await insert(
          "organization",
          {
            ...input,
            slug: slug(input.name),
            owner_id: actor.id,
            verification_status: "Pending",
            created_at: now(),
          },
          db,
        ),
      };
    }
    const org = await find("organization", key, db);
    check(org, "Organization not found.", 404);
    check(
      org.owner_id === actor.id,
      "Only the owner can manage this organization.",
      403,
    );
    if (action === "edit") {
      const input = organizationSchema.parse(body);
      return {
        value: await save(
          "organization",
          {
            ...org,
            ...input,
            verification_status: "Pending",
            updated_at: now(),
          },
          db,
        ),
      };
    }
    if (action === "venue") {
      const input = venueSchema.parse(body);
      return {
        value: await insert(
          "venue",
          {
            ...input,
            owner_id: actor.id,
            organization_id: org.id,
            organization_name: org.name,
            verification_status: "UNVERIFIED",
            reviews: [],
            created_at: now(),
          },
          db,
        ),
      };
    }
    check(false, "Action not found.", 404);
  }
  if (area === "venues") {
    const venue = await find(
      key.startsWith("standalone-") ? "standalone_venue" : "venue",
      key.replace(/^standalone-/, ""),
      db,
    );
    check(venue, "Venue not found.", 404);
    if (action === "edit") {
      check(
        venue.owner_id === actor.id,
        "Only the owner can edit this venue.",
        403,
      );
      const input = venueSchema.parse(body);
      return {
        value: await save(
          "venue",
          {
            ...venue,
            ...input,
            verification_status: "UNVERIFIED",
            updated_at: now(),
          },
          db,
        ),
      };
    }
    if (action === "review") {
      check(
        venue.owner_id !== actor.id,
        "Owners cannot review their own venues.",
      );
      check(
        venue.public_visible &&
          !venue.hidden &&
          venue.verification_status !== "SUSPENDED",
        "Venue unavailable.",
        404,
      );
      const input = z
        .object({
          rating: z.coerce.number().int().min(1).max(5),
          body: text(2000),
        })
        .parse(body);
      venue.reviews ??= [];
      const old = venue.reviews.find(
        (r: RecordData) => r.author.id === actor.id,
      );
      const review = {
        ...input,
        id:
          old?.id ??
          Math.max(0, ...venue.reviews.map((r: RecordData) => r.id)) + 1,
        author: summary(actor),
        created_at: old?.created_at ?? now(),
        updated_at: now(),
      };
      venue.reviews = venue.reviews.filter(
        (r: RecordData) => r.author.id !== actor.id,
      );
      venue.reviews.push(review);
      await save(
        key.startsWith("standalone-") ? "standalone_venue" : "venue",
        venue,
        db,
      );
      return { value: { ok: true } };
    }
    check(false, "Action not found.", 404);
  }
  if (
    area === "teams" &&
    ["invite", "transfer", "remove", "edit", "captain"].includes(action)
  ) {
    const team = await find("team", key, db);
    check(team, "Team not found.", 404);
    check(
      team.owner_id === actor.id,
      "Only the owner can manage the team.",
      403,
    );
    if (action === "edit") {
      const input = z
        .object({
          description: z.string().trim().max(2000),
          status: z.enum(["Recruiting", "Active", "Archived"]),
        })
        .parse(body);
      await save("team", { ...team, ...input }, db);
      return { value: { ok: true } };
    }
    const target = (await list("profile", db)).find(
      (p) =>
        p.gamer_tag === body.gamer_tag ||
        String(p.id) === String(body.player_id),
    );
    check(
      target && target.id !== actor.id && !target.suspended_at,
      "Choose another active player.",
    );
    check(
      !target.blocked.includes(actor.id) && !actor.blocked.includes(target.id),
      "Player unavailable.",
      403,
    );
    if (action === "remove" || action === "captain") {
      check(
        team.roster.some((p: RecordData) => p.id === target.id),
        "Player is not on this team.",
      );
      if (action === "remove")
        team.roster = team.roster.filter((p: RecordData) => p.id !== target.id);
      else
        team.roster = team.roster.map((p: RecordData) =>
          p.id === target.id
            ? { ...p, role: body.role === "Captain" ? "Captain" : "Member" }
            : p,
        );
      team.member_count = team.roster.length;
      await save("team", team, db);
      return { value: { ok: true } };
    }
    check(
      team.status !== "Archived",
      "Archived teams cannot send invitations.",
    );
    const type = action === "transfer" ? "ownership" : "team";
    check(
      action === "transfer"
        ? team.roster.some((p: RecordData) => p.id === target.id)
        : !team.roster.some((p: RecordData) => p.id === target.id),
      action === "transfer"
        ? "Transfer ownership to an existing member."
        : "Player is already a member.",
    );
    check(
      !(await list("invitation", db)).some(
        (i) =>
          i.team_id === team.id &&
          i.recipient_id === target.id &&
          i.type === type &&
          i.status === "Pending",
      ),
      "An invitation is already pending.",
    );
    const invitation = await insert(
      "invitation",
      {
        type,
        team_id: team.id,
        team_name: team.name,
        team_slug: team.slug,
        actor_id: actor.id,
        actor: summary(actor),
        recipient_id: target.id,
        recipient: summary(target),
        status: "Pending",
        created_at: now(),
      },
      db,
    );
    await notification(
      target.id,
      actor,
      `${actor.gamer_tag} invited you to ${action === "transfer" ? "own" : "join"} ${team.name}.`,
      "/invitations",
      db,
    );
    return { value: invitation };
  }
  if (area === "tournaments" && action === "invite") {
    const t = await find("tournament", key, db);
    check(
      t && t.organizer_id === actor.id,
      "Only the organizer can invite players.",
      403,
    );
    check(
      ["Draft", "Open"].includes(t.status),
      "This tournament is no longer accepting invitations.",
    );
    const p = (await list("profile", db)).find(
      (p) => p.gamer_tag === body.gamer_tag,
    );
    check(
      p &&
        p.id !== actor.id &&
        !p.suspended_at &&
        !p.blocked.includes(actor.id) &&
        !actor.blocked.includes(p.id),
      "Choose another available player.",
    );
    check(
      !t.participants.some((r: RecordData) => r.id === p.id),
      "Player is already registered.",
    );
    check(
      !(await list("tournament_invitation", db)).some(
        (i) =>
          i.tournament_id === t.id &&
          i.recipient_id === p.id &&
          i.status === "Pending",
      ),
      "An invitation is already pending.",
    );
    const i = await insert(
      "tournament_invitation",
      {
        tournament_id: t.id,
        recipient_id: p.id,
        recipient: summary(p),
        actor_id: actor.id,
        actor: summary(actor),
        team_name: t.name,
        target_url: `/tournaments/${t.slug}`,
        status: "Pending",
        created_at: now(),
      },
      db,
    );
    await notification(
      p.id,
      actor,
      `${actor.gamer_tag} invited you to ${t.name}.`,
      "/invitations",
      db,
    );
    return { value: i };
  }
  if (area === "invitations" && key.startsWith("tournament-")) {
    const i = await find("tournament_invitation", key.slice(11), db);
    check(i, "Invitation not found.", 404);
    check(
      i.status === "Pending",
      "This invitation has already been handled.",
      409,
    );
    const t = await find("tournament", i.tournament_id, db);
    check(t, "Tournament not found.", 404);
    if (action === "cancel") {
      check(i.actor_id === actor.id, "Only the sender can cancel.", 403);
      i.status = "Cancelled";
    } else {
      check(
        i.recipient_id === actor.id,
        "Only the recipient can respond.",
        403,
      );
      check(["accept", "decline"].includes(action), "Action not found.", 404);
      if (action === "accept") {
        check(
          t.status === "Open" &&
            new Date(t.registration_deadline).getTime() > Date.now(),
          "Registration is closed.",
        );
        check(
          !t.participants.some((p: RecordData) => p.id === actor.id),
          "Already registered.",
        );
        check(
          t.participants.length < t.max_participants,
          "Tournament is full.",
        );
        t.participants.push({ ...summary(actor), status: "Registered" });
        t.participant_count = t.participants.length;
        await save("tournament", t, db);
      }
      i.status = action === "accept" ? "Accepted" : "Declined";
    }
    i.responded_at = now();
    await save("tournament_invitation", i, db);
    return { value: { ok: true } };
  }
  if (area === "message-requests") {
    const r = await find("message_request", key, db);
    check(r && r.recipient_id === actor.id, "Request not found.", 404);
    check(
      r.status === "Pending",
      "This request has already been handled.",
      409,
    );
    check(["accept", "decline"].includes(action), "Action not found.", 404);
    const sender = await find("profile", r.sender_id, db);
    check(
      sender &&
        !sender.blocked.includes(actor.id) &&
        !actor.blocked.includes(sender.id),
      "Player unavailable.",
      403,
    );
    if (action === "accept") {
      let conversation = (await list("conversation", db)).find(
        (c) =>
          c.participants.length === 2 &&
          c.participants.includes(actor.id) &&
          c.participants.includes(sender.id),
      );
      conversation ??= await insert(
        "conversation",
        {
          participants: [actor.id, sender.id],
          messages: [],
          updated_at: now(),
        },
        db,
      );
      r.conversation_id = conversation.id;
    }
    r.status = action === "accept" ? "Accepted" : "Declined";
    await save("message_request", r, db);
    return { value: { ok: true, conversation_id: r.conversation_id } };
  }
  if (area === "invitations") {
    const i = await find("invitation", key, db);
    check(i, "Invitation not found.", 404);
    check(
      i.status === "Pending",
      "This invitation has already been handled.",
      409,
    );
    if (action === "cancel") {
      check(i.actor_id === actor.id, "Only the sender can cancel.", 403);
      i.status = "Cancelled";
    } else {
      check(
        i.recipient_id === actor.id,
        "Only the recipient can respond.",
        403,
      );
      check(["accept", "decline"].includes(action), "Action not found.", 404);
      const team = await find("team", i.team_id, db);
      check(
        team && team.owner_id === i.actor_id && team.status !== "Archived",
        "The team or invitation is no longer available.",
      );
      const sender = await find("profile", i.actor_id, db);
      check(
        sender &&
          !sender.blocked.includes(actor.id) &&
          !actor.blocked.includes(sender.id),
        "Invitation unavailable.",
        403,
      );
      if (action === "accept") {
        if (i.type === "ownership") {
          check(
            team.roster.some((p: RecordData) => p.id === actor.id),
            "You must still be a team member.",
          );
          team.owner_id = actor.id;
          team.owner_gamer_tag = actor.gamer_tag;
          team.roster = team.roster.map((p: RecordData) => ({
            ...p,
            is_owner: p.id === actor.id,
            role: p.id === actor.id ? "Captain" : p.role,
          }));
        } else if (!team.roster.some((p: RecordData) => p.id === actor.id))
          team.roster.push({
            ...summary(actor),
            role: "Member",
            is_owner: false,
          });
        team.member_count = team.roster.length;
        await save("team", team, db);
      }
      i.status = action === "accept" ? "Accepted" : "Declined";
      await notification(
        i.actor_id,
        actor,
        `${actor.gamer_tag} ${i.status.toLowerCase()} your ${i.type} invitation.`,
        `/teams/${team.slug}`,
        db,
      );
    }
    i.responded_at = now();
    await save("invitation", i, db);
    return { value: { ok: true } };
  }
  if (area === "games" && action === "library") {
    const game = await find("game", key, db);
    check(game && !game.hidden, "Game not found.", 404);
    actor.games = actor.games.includes(game.id)
      ? actor.games.filter((id: number) => id !== game.id)
      : [...actor.games, game.id];
    await save("profile", actor, db);
    return { value: { ok: true, in_library: actor.games.includes(game.id) } };
  }
  if (area === "games" && action === "challenge") {
    const game = await find("game", key, db);
    check(game && !game.hidden, "Game not found.", 404);
    const target = (await list("profile", db)).find(
      (p) =>
        p.gamer_tag === body.opponent || String(p.id) === String(body.opponent),
    );
    check(
      target && target.id !== actor.id && !target.suspended_at,
      "Choose another active player.",
    );
    check(
      !target.blocked.includes(actor.id) && !actor.blocked.includes(target.id),
      "Player unavailable.",
      403,
    );
    check(
      !(await list("challenge", db)).some(
        (c) =>
          c.game_id === game.id &&
          [
            "Pending",
            "Accepted",
            "Scheduled",
            "Awaiting Confirmation",
            "Disputed",
          ].includes(c.status) &&
          [c.challenger.id, c.opponent.id].includes(actor.id) &&
          [c.challenger.id, c.opponent.id].includes(target.id),
      ),
      "An active challenge already exists between you for this game.",
    );
    const c = await insert(
      "challenge",
      {
        game_id: game.id,
        game_name: game.name,
        challenger: summary(actor),
        opponent: summary(target),
        status: "Pending",
        created_at: now(),
      },
      db,
    );
    await notification(
      target.id,
      actor,
      `${actor.gamer_tag} challenged you to ${game.name}.`,
      "/challenges",
      db,
    );
    return {
      value: {
        ok: true,
        id: c.id,
        message: "Challenge sent. Track it in Challenges.",
      },
    };
  }
  if (area === "challenges") {
    const c = await find("challenge", key, db);
    check(c, "Challenge not found.", 404);
    check(
      [c.challenger.id, c.opponent.id].includes(actor.id),
      "This challenge is private.",
      403,
    );
    const otherId =
      c.challenger.id === actor.id ? c.opponent.id : c.challenger.id;
    const other = await find("profile", otherId, db);
    check(
      other &&
        !other.blocked.includes(actor.id) &&
        !actor.blocked.includes(otherId),
      "Player unavailable.",
      403,
    );
    if (action === "accept" || action === "decline") {
      check(
        c.opponent.id === actor.id && c.status === "Pending",
        "Only the invited player can respond to a pending challenge.",
        403,
      );
      c.status = action === "accept" ? "Accepted" : "Declined";
    } else if (action === "cancel") {
      check(
        c.challenger.id === actor.id &&
          ["Pending", "Accepted", "Scheduled"].includes(c.status),
        "This challenge cannot be cancelled.",
      );
      c.status = "Cancelled";
    } else if (action === "schedule") {
      check(
        ["Accepted", "Scheduled"].includes(c.status),
        "Accept the challenge before scheduling.",
      );
      const date = z.iso.datetime({ offset: true }).parse(body.scheduled_at);
      check(new Date(date).getTime() > Date.now(), "Choose a future time.");
      c.scheduled_at = date;
      c.status = "Scheduled";
    } else if (action === "result") {
      check(
        ["Accepted", "Scheduled"].includes(c.status),
        "This challenge cannot accept a new result.",
      );
      const result = z
        .object({ winner: text(50), score: text(50) })
        .parse(body);
      check(
        [c.challenger.gamer_tag, c.opponent.gamer_tag].includes(result.winner),
        "Winner must be one of the players.",
      );
      c.result = { ...result, proposed_by: actor.id, proposed_at: now() };
      c.status = "Awaiting Confirmation";
    } else if (action === "confirm" || action === "dispute") {
      check(
        c.status === "Awaiting Confirmation" &&
          c.result.proposed_by !== actor.id,
        "Only the other player can confirm or dispute a proposed result.",
      );
      c.status = action === "confirm" ? "Completed" : "Disputed";
      if (action === "confirm") {
        for (const id of [c.challenger.id, c.opponent.id]) {
          const p = await find("profile", id, db);
          check(p, "Player not found.");
          p.matches_played++;
          if (p.gamer_tag === c.result.winner) p.match_wins++;
          await save("profile", p, db);
        }
      } else {
        await insert(
          "report",
          {
            reporter_id: actor.id,
            target_type: "challenge",
            target_id: c.id,
            reason: "Disputed match result",
            details: String(body.reason ?? "").slice(0, 1000),
            status: "Open",
            created_at: now(),
          },
          db,
        );
      }
    } else check(false, "Action not found.", 404);
    c.updated_at = now();
    await save("challenge", c, db);
    await notification(
      otherId,
      actor,
      `${actor.gamer_tag} updated your ${c.game_name} challenge: ${c.status}.`,
      "/challenges",
      db,
    );
    return { value: { ok: true } };
  }
  if (area === "admin") {
    const role = await staffRole(actor, db);
    check(role, "Staff access required.", 403);
    const reason = text(1000).parse(body.reason);
    if (key === "promotion") {
      const promotion = await find("promotion", action, db);
      check(promotion, "Promotion request not found.", 404);
      const decision = z
        .enum(["approve", "reject", "under_review"])
        .parse(body.decision);
      const event = await find("event", promotion.event_id, db);
      check(event, "Event not found.", 404);
      promotion.status = {
        approve: "Approved",
        reject: "Rejected",
        under_review: "Under Review",
      }[decision];
      promotion.reviewer_id = actor.id;
      promotion.review_notes = reason;
      if (decision !== "under_review") event.featured = decision === "approve";
      await save("event", event, db);
      await save("promotion", promotion, db);
      await insert(
        "audit",
        {
          actor_id: actor.id,
          action: "promotion." + decision,
          target_id: promotion.id,
          reason,
          created_at: now(),
        },
        db,
      );
      return { value: { ok: true } };
    }
    if (key === "report") {
      const report = await find("report", action, db);
      check(report, "Report not found.", 404);
      check(
        ["resolve", "dismiss"].includes(String(body.decision)),
        "Choose resolve or dismiss.",
      );
      report.status = body.decision === "resolve" ? "Resolved" : "Dismissed";
      report.resolved_by = actor.id;
      report.resolved_at = now();
      report.resolution = reason;
      await save("report", report, db);
      await insert(
        "audit",
        {
          actor_id: actor.id,
          action: "report." + body.decision,
          target_id: report.id,
          reason,
          created_at: now(),
        },
        db,
      );
      return { value: { ok: true } };
    }
    if (key === "content") {
      const kind = z
        .enum([
          "post",
          "listing",
          "profile",
          "organization",
          "venue",
          "challenge",
        ])
        .parse(body.kind);
      const target = await find(kind, Number(body.id), db);
      check(target, "Content not found.", 404);
      const decision = z
        .enum([
          "hide",
          "restore",
          "verify",
          "reject",
          "suspend",
          "reinstate",
          "resolve-match",
        ])
        .parse(body.decision);
      if (kind === "profile") {
        check(
          role === "admin",
          "Only administrators can suspend accounts.",
          403,
        );
        check(target.id !== actor.id, "You cannot suspend your own account.");
        check(
          ["suspend", "reinstate"].includes(decision),
          "Choose suspend or reinstate.",
        );
        target.suspended_at = decision === "suspend" ? now() : null;
      } else if (decision === "verify" || decision === "reject") {
        check(
          ["organization", "venue"].includes(kind),
          "Only organizations and venues can be verified.",
        );
        target.verification_status =
          kind === "venue"
            ? decision === "verify"
              ? "VERIFIED"
              : "SUSPENDED"
            : decision === "verify"
              ? "Verified"
              : "Rejected";
      } else if (decision === "resolve-match") {
        check(
          kind === "challenge" &&
            ["Disputed", "Needs Reconciliation"].includes(target.status),
          "Only disputed or unreconciled challenges need resolution.",
        );
        check(
          [target.challenger.gamer_tag, target.opponent.gamer_tag].includes(
            body.winner,
          ),
          "Choose a valid player.",
        );
        const legacyReconciliation = target.status === "Needs Reconciliation";
        target.result = { ...target.result, winner: body.winner };
        target.status = "Completed";
        for (const id of legacyReconciliation
          ? []
          : [target.challenger.id, target.opponent.id]) {
          const p = await find("profile", id, db);
          check(p, "Player not found.");
          p.matches_played++;
          if (p.gamer_tag === body.winner) p.match_wins++;
          await save("profile", p, db);
        }
      } else {
        check(
          ["hide", "restore"].includes(decision),
          "Action not available for this content.",
        );
        target.hidden = decision === "hide";
      }
      await save(kind, target, db);
      await insert(
        "audit",
        {
          actor_id: actor.id,
          action: kind + "." + decision,
          target_id: target.id,
          reason,
          created_at: now(),
        },
        db,
      );
      return { value: { ok: true } };
    }
    check(false, "Action not found.", 404);
  }
  return undefined;
}
