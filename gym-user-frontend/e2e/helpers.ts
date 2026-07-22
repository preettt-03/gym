import { Client } from "pg";

const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://gym:gym@localhost:8001/gym?schema=public";

export function uniqueTestEmail(label: string) {
  return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

// Registration only queues an OTP email (or logs it to console if SMTP isn't
// configured) — reading the code straight from Postgres is more reliable than
// parsing container logs and works the same whether SMTP is configured or not.
export async function getLatestOtp(email: string): Promise<string> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT o.code FROM otp_codes o JOIN users u ON u.id = o."userId"
       WHERE u.email = $1 ORDER BY o."createdAt" DESC LIMIT 1`,
      [email]
    );
    if (result.rows.length === 0) throw new Error(`No OTP found for ${email}`);
    return result.rows[0].code as string;
  } finally {
    await client.end();
  }
}

export async function deleteTestUser(email: string) {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM users WHERE email = $1`, [email]);
  } finally {
    await client.end();
  }
}
