import { sql } from "kysely";
import { database } from "./db";

/** Explicit additive migration. Never invoked by request handlers or during a build. */
export async function migrate() {
  const db = await database();
  const statements = [
    `CREATE TABLE IF NOT EXISTS ggz_user (id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, "emailVerified" boolean NOT NULL DEFAULT false, image text, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), username text UNIQUE, "displayUsername" text)`,
    `CREATE TABLE IF NOT EXISTS ggz_session (id text PRIMARY KEY, "expiresAt" timestamptz NOT NULL, token text NOT NULL UNIQUE, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ipAddress" text, "userAgent" text, "userId" text NOT NULL REFERENCES ggz_user(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS ggz_account (id text PRIMARY KEY, "accountId" text NOT NULL, "providerId" text NOT NULL, "userId" text NOT NULL REFERENCES ggz_user(id) ON DELETE CASCADE, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, scope text, password text, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), UNIQUE("providerId", "accountId"))`,
    `CREATE TABLE IF NOT EXISTS ggz_verification (id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, "expiresAt" timestamptz NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS ggz_rate_limit (id text PRIMARY KEY, key text NOT NULL UNIQUE, count integer NOT NULL, "lastRequest" bigint NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ggz_entity (id serial PRIMARY KEY, kind text NOT NULL, data jsonb NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS ggz_entity_kind_idx ON ggz_entity(kind)`,
    `CREATE INDEX IF NOT EXISTS ggz_entity_data_idx ON ggz_entity USING gin(data)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ggz_profile_user_idx ON ggz_entity((data->>'user_id')) WHERE kind='profile'`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ggz_profile_tag_idx ON ggz_entity(lower(data->>'gamer_tag')) WHERE kind='profile'`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ggz_slug_idx ON ggz_entity(kind, (data->>'slug')) WHERE kind IN ('team','tournament')`,
  ];
  await db.transaction().execute(async (tx) => {
    for (const statement of statements) await sql.raw(statement).execute(tx);
    for (const table of [
      "ggz_user",
      "ggz_session",
      "ggz_account",
      "ggz_verification",
      "ggz_rate_limit",
      "ggz_entity",
    ]) {
      await sql
        .raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`)
        .execute(tx);
      await sql.raw(`REVOKE ALL ON ${table} FROM PUBLIC`).execute(tx);
      for (const role of ["anon", "authenticated"])
        await sql
          .raw(
            `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${role}') THEN REVOKE ALL ON ${table} FROM ${role}; END IF; END $$`,
          )
          .execute(tx);
    }
  });
}
