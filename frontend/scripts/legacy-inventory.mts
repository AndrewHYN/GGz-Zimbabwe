import { Pool } from "pg";
if (!process.env.LEGACY_DATABASE_URL)
  throw new Error(
    "LEGACY_DATABASE_URL is required. Supply it through your environment; never commit it.",
  );
const pool = new Pool({
  connectionString: process.env.LEGACY_DATABASE_URL,
  max: 1,
});
const client = await pool.connect();
try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const { rows } = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE 'accounts_%' OR table_name LIKE 'games_%' OR table_name LIKE 'events_%' OR table_name LIKE 'tournaments_%' OR table_name LIKE 'teams_%' OR table_name LIKE 'marketplace_%' OR table_name='auth_user') ORDER BY table_name",
  );
  for (const { table_name } of rows) {
    if (!/^[a-z_]+$/.test(table_name)) throw new Error("Unexpected table name");
    const count = await client.query(
      `SELECT count(*)::integer AS count FROM "${table_name}"`,
    );
    console.log(`${table_name}: ${count.rows[0].count}`);
  }
  const passwords = await client.query(
    "SELECT split_part(password,'$',1) AS algorithm,count(*)::integer AS count FROM auth_user GROUP BY 1",
  );
  console.log("Password algorithms:", passwords.rows);
  const duplicates = await client.query(
    "SELECT count(*)::integer AS count FROM (SELECT lower(email) FROM auth_user GROUP BY lower(email) HAVING count(*)>1 OR lower(email)='') x",
  );
  console.log("Email groups requiring review:", duplicates.rows[0].count);
  await client.query("ROLLBACK");
} finally {
  client.release();
  await pool.end();
}
