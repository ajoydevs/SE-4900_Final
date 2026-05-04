import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { getPool } from "@/lib/db/pool";

const INTERNAL_EMAIL = "docsync-local-workspace@internal.invalid";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

/**
 * Single-tenant workspace user for local MVP after auth UI removal.
 * Prefer `DOCSYNC_DEFAULT_USER_ID` when you already have a row in `users`.
 * Otherwise uses the oldest user, or creates an internal placeholder user.
 */
export async function getAppUserId(): Promise<string> {
  const pool = getPool();
  const envId = process.env.DOCSYNC_DEFAULT_USER_ID?.trim();
  if (envId && isUuid(envId)) {
    const { rows } = await pool.query<{ id: string }>(
      `select id from users where id = $1`,
      [envId]
    );
    if (rows[0]) return rows[0].id;
  }

  const { rows: first } = await pool.query<{ id: string }>(
    `select id from users order by created_at asc limit 1`
  );
  if (first[0]) return first[0].id;

  const hash = await bcrypt.hash(randomUUID() + randomUUID(), 10);
  const ins = await pool.query<{ id: string }>(
    `insert into users (email, password_hash) values ($1, $2)
     on conflict (email) do update set password_hash = users.password_hash
     returning id`,
    [INTERNAL_EMAIL, hash]
  );
  if (ins.rows[0]) return ins.rows[0].id;

  const { rows: byEmail } = await pool.query<{ id: string }>(
    `select id from users where email = $1`,
    [INTERNAL_EMAIL]
  );
  if (byEmail[0]) return byEmail[0].id;

  throw new Error("Could not resolve default workspace user.");
}
