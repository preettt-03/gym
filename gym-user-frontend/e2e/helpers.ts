import { createHmac, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://gym:gym@localhost:8001/gym?schema=public";

export function uniqueTestEmail(label: string) {
  return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

// The backend stores only a keyed hash of each OTP (keyed with its access-token
// secret), so the emailed code can't be read back. Instead we pin the latest OTP
// to a fresh code using the same secret from gym-backend/.env and return it.
function otpSecret(): string {
  if (process.env.E2E_JWT_ACCESS_SECRET) return process.env.E2E_JWT_ACCESS_SECRET;
  const envFile = readFileSync(path.join(__dirname, "../../gym-backend/.env"), "utf8");
  const line = envFile.split("\n").find((l) => l.startsWith("JWT_ACCESS_SECRET="));
  if (!line) throw new Error("Set E2E_JWT_ACCESS_SECRET or add JWT_ACCESS_SECRET to gym-backend/.env");
  return line.slice("JWT_ACCESS_SECRET=".length).trim().replace(/^["']|["']$/g, "");
}

function hashOtp(code: string) {
  const key = createHmac("sha256", otpSecret()).update("otp-codes").digest();
  return createHmac("sha256", key).update(code).digest("hex");
}

export async function getLatestOtp(email: string): Promise<string> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const result = await client.query(
      `UPDATE otp_codes SET "codeHash" = $2 WHERE id = (
         SELECT o.id FROM otp_codes o JOIN users u ON u.id = o."userId"
         WHERE u.email = $1 ORDER BY o."createdAt" DESC LIMIT 1)`,
      [email, hashOtp(code)]
    );
    if (result.rowCount === 0) throw new Error(`No OTP found for ${email}`);
    return code;
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

/** In dev the backend logs SMS codes instead of texting them; read the newest one for a number. */
export async function getLatestSmsCode(phoneE164: string): Promise<string> {
  const { execSync } = await import("node:child_process");
  for (let attempt = 0; attempt < 10; attempt++) {
    const logs = execSync("docker logs gym-backend --since 2m 2>&1", { encoding: "utf8" });
    const matches = [...logs.matchAll(new RegExp(`\\[sms:stub\\] to=\\${phoneE164} code=(\\d{6})`, "g"))];
    if (matches.length) return matches.at(-1)![1];
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No SMS code logged for ${phoneE164}`);
}

export async function deleteUserByPhone(phoneE164: string) {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM users WHERE phone = $1`, [phoneE164]);
  } finally {
    await client.end();
  }
}

export const randomIndianMobile = () => `9${Math.floor(100000000 + Math.random() * 899999999)}`;
