import { randomUUID } from "node:crypto";
import { Client } from "pg";

const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://gym:gym@localhost:8001/gym?schema=public";

async function withDb<T>(fn: (db: Client) => Promise<T>) {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

/** A throwaway member straight in the DB (no email or OTP involved). */
export async function createMember(name: string) {
  const id = randomUUID();
  const email = `e2e-crm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  await withDb((db) =>
    db.query(`INSERT INTO users (id, email, name, role, "accountStatus", "isEmailVerified", "updatedAt") VALUES ($1, $2, $3, 'USER', 'ACTIVE', true, NOW())`, [id, email, name])
  );
  return { id, email };
}

/** Removes the member and everything hanging off them. */
export async function deleteMember(id: string) {
  await withDb(async (db) => {
    await db.query(`DELETE FROM payments WHERE "userId" = $1`, [id]);
    await db.query(`DELETE FROM attendances WHERE "userId" = $1`, [id]);
    await db.query(`DELETE FROM memberships WHERE "userId" = $1`, [id]);
    await db.query(`DELETE FROM users WHERE id = $1`, [id]);
  });
}
