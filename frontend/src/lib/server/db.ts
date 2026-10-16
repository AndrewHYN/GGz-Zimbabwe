import {
  Kysely,
  PostgresDialect,
  sql,
  type Transaction,
  type Generated,
} from "kysely";
import { Pool } from "pg";

export interface RecordData {
  // Entity payloads are validated at the API boundary; the store is deliberately schema agnostic.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
  id: number;
}
interface Tables {
  ggz_entity: { id: Generated<number>; kind: string; data: RecordData };
}
export type Database = Kysely<Tables> | Transaction<Tables>;
const globalDb = globalThis as typeof globalThis & {
  ggzDb?: Promise<Kysely<Tables>>;
};

export async function database(): Promise<Kysely<Tables>> {
  if (!globalDb.ggzDb) globalDb.ggzDb = connect();
  return globalDb.ggzDb;
}
async function connect(): Promise<Kysely<Tables>> {
  if (process.env.DATABASE_URL) {
    return new Kysely<Tables>({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString: process.env.DATABASE_URL,
          max: 5,
          connectionTimeoutMillis: 10000,
        }),
      }),
    });
  }
  if (process.env.GGZ_LOCAL_DATABASE && !process.env.VERCEL) {
    const { KyselyPGlite } = await import("kysely-pglite");
    const { dialect } = await KyselyPGlite.create(
      process.env.GGZ_LOCAL_DATABASE,
    );
    return new Kysely<Tables>({ dialect });
  }
  throw new Error(
    "DATABASE_URL is required. GGZ_LOCAL_DATABASE is available only for local development.",
  );
}

export async function list(kind: string, db?: Database): Promise<RecordData[]> {
  const rows = await (db ?? (await database()))
    .selectFrom("ggz_entity")
    .select(["id", "data"])
    .where("kind", "=", kind)
    .orderBy("id")
    .execute();
  return rows.map((row) => ({ ...row.data, id: Number(row.id) }));
}
export async function find(kind: string, id: string | number, db?: Database) {
  return (await list(kind, db)).find(
    (row) => String(row.id) === String(id) || row.slug === id,
  );
}
export async function insert(
  kind: string,
  data: Omit<RecordData, "id">,
  db?: Database,
): Promise<RecordData> {
  const row = await (db ?? (await database()))
    .insertInto("ggz_entity")
    .values({ kind, data: data as RecordData })
    .returning(["id", "data"])
    .executeTakeFirstOrThrow();
  return { ...row.data, id: Number(row.id) };
}
export async function save(kind: string, data: RecordData, db?: Database) {
  await (db ?? (await database()))
    .updateTable("ggz_entity")
    .set({ data })
    .where("kind", "=", kind)
    .where("id", "=", data.id)
    .execute();
  return data;
}
export async function remove(kind: string, id: number, db?: Database) {
  await (db ?? (await database()))
    .deleteFrom("ggz_entity")
    .where("kind", "=", kind)
    .where("id", "=", id)
    .execute();
}
/** Serialize related writes across serverless instances, including capacity and bracket transitions. */
let localQueue = Promise.resolve();
export async function atomic<T>(
  action: (db: Database) => Promise<T>,
): Promise<T> {
  // PGlite has a single connection; serialize complete local transactions, not individual queries.
  const previous = localQueue;
  let release = () => {};
  if (!process.env.DATABASE_URL) {
    localQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
  }
  try {
    return await (await database()).transaction().execute(async (db) => {
      await sql`select pg_advisory_xact_lock(7342026)`.execute(db);
      return action(db);
    });
  } finally {
    release();
  }
}
