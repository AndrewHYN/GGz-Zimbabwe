import { sql } from "kysely";
import { database } from "../src/lib/server/db";
const [email, role] = process.argv.slice(2);
if (!email || !["admin", "moderator", "revoke"].includes(role))
  throw Error(
    "Usage: staff <exact-account-email> admin|moderator|revoke. Requires direct database administration access.",
  );
const db = await database();
const users = await sql<{
  id: string;
}>`select id from ggz_user where lower(email)=${email.toLowerCase()}`.execute(
  db,
);
if (users.rows.length !== 1)
  throw Error("Exactly one matching account is required.");
if (role === "revoke")
  await sql`delete from ggz_staff where user_id=${users.rows[0].id}`.execute(
    db,
  );
else
  await sql`insert into ggz_staff(user_id,role) values(${users.rows[0].id},${role}) on conflict(user_id) do update set role=excluded.role`.execute(
    db,
  );
console.log("Staff permission updated. No credentials were displayed.");
await db.destroy();
