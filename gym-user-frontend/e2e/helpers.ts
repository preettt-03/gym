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

const API_URL = process.env.E2E_API_URL ?? "http://localhost:8004/api/v1";

// Registers through the real API and verifies with the OTP from the DB, so
// the account goes through exactly the same path as a real sign-up.
export async function createVerifiedUser(email: string, password: string, name: string) {
  const register = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!register.ok) throw new Error(`Register failed for ${email}: ${register.status}`);
  const code = await getLatestOtp(email);
  const verify = await fetch(`${API_URL}/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  if (!verify.ok) throw new Error(`Verify failed for ${email}: ${verify.status}`);
}

// Makes `trainerEmail` a trainer coaching `traineeEmail`.
export async function assignTrainer(trainerEmail: string, traineeEmail: string) {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(`UPDATE users SET role = 'TRAINER' WHERE email = $1 RETURNING id`, [trainerEmail]);
    await client.query(`UPDATE users SET "trainerId" = $1 WHERE email = $2`, [rows[0].id, traineeEmail]);
  } finally {
    await client.end();
  }
}

// Trainees reference their trainer, so clear that link before deleting.
export async function deleteTrainerAndTrainee(trainerEmail: string, traineeEmail: string) {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(`UPDATE users SET "trainerId" = NULL WHERE email = $1`, [traineeEmail]);
    await client.query(`DELETE FROM users WHERE email = ANY($1)`, [[traineeEmail, trainerEmail]]);
  } finally {
    await client.end();
  }
}
