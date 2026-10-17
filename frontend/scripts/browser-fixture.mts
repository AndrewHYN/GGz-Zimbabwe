import { sql } from "kysely";
import { hashPassword } from "better-auth/crypto";
import { database } from "../src/lib/server/db";
import { ensureProfile } from "../src/lib/server/platform";
if (
  process.env.VERCEL ||
  !process.env.GGZ_LOCAL_DATABASE ||
  process.env.DATABASE_URL
)
  throw Error(
    "Browser fixtures are restricted to the isolated local database.",
  );
const db = await database();
const id = "local-browser-staff-fixture";
const exists = await sql`select id from ggz_user where id=${id}`.execute(db);
if (!exists.rows.length) {
  await sql`insert into ggz_user(id,name,email,username,"displayUsername") values(${id},'LocalBrowserStaff','browser-staff@test.invalid','browser_staff','browser_staff')`.execute(
    db,
  );
  await sql`insert into ggz_account(id,"accountId","providerId","userId",password) values('local-browser-staff-credential',${id},'credential',${id},${await hashPassword("Browser-fixture-password-123")})`.execute(
    db,
  );
}
await ensureProfile({
  id,
  name: "LocalBrowserStaff",
  email: "browser-staff@test.invalid",
  username: "browser_staff",
});
await sql`insert into ggz_staff(user_id,role) values(${id},'admin') on conflict(user_id) do update set role=excluded.role`.execute(
  db,
);
await db.destroy();
console.log("Isolated browser staff fixture ready.");
