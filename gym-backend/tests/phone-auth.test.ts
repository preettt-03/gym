import request from 'supertest';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { hashOtp } from '@/lib/otp';
import { signAccessToken } from '@/lib/jwt';
import { app, deleteTestUser, uniqueTestEmail } from './helpers';

// Codes are random and only stored hashed, so tests overwrite the stored hash
// with a known code — the same trick the email OTP helper uses.
async function pinCode(purpose: string, target: string, code = '246810') {
  const key = `cotp:${purpose}:${target.toLowerCase()}`;
  const entry = JSON.parse((await redis.get(key))!);
  await redis.set(key, JSON.stringify({ ...entry, hash: hashOtp(code) }), 'KEEPTTL');
  return code;
}
const clearCooldowns = async (target: string) => {
  const keys = await redis.keys(`cotp*${target.toLowerCase()}`);
  if (keys.length) await redis.del(...keys);
};

const randomMobile = () => `9${Math.floor(100000000 + Math.random() * 899999999)}`;

describe('Mobile number sign-in and contact changes', () => {
  const mobile = randomMobile();
  const e164 = `+91${mobile}`;
  let userId: string;
  const extraEmails: string[] = [];

  afterAll(async () => {
    await clearCooldowns(e164);
    await prisma.user.deleteMany({ where: { OR: [{ phone: { in: [e164] } }, { email: { in: extraEmails } }] } });
  });

  it('signs up with just a mobile number', async () => {
    const send = await request(app).post('/api/v1/auth/phone/send-otp').send({ phone: `${mobile.slice(0, 5)} ${mobile.slice(5)}`, mode: 'signup', name: 'Phone Person' });
    expect(send.status).toBe(200);
    expect(send.body).toMatchObject({ cooldownSeconds: 60 });
    expect(send.body.phone).toMatch(/•+.*\d{4}$/);

    const again = await request(app).post('/api/v1/auth/phone/send-otp').send({ phone: mobile, mode: 'signup', name: 'Phone Person' });
    expect(again.status).toBe(429);

    const wrong = await request(app).post('/api/v1/auth/phone/verify').send({ phone: mobile, mode: 'signup', code: '000000' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.details).toMatchObject({ code: 'OTP_WRONG', attemptsLeft: 4 });

    const code = await pinCode('phone-signup', e164);
    const res = await request(app).post('/api/v1/auth/phone/verify').send({ phone: `+91 ${mobile}`, mode: 'signup', code });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ phone: e164, isPhoneVerified: true, email: null, name: 'Phone Person' });
    expect(res.headers['set-cookie']?.[0]).toMatch(/^refreshToken=/);
    userId = res.body.user.id;

    // A used code can't be replayed.
    expect((await request(app).post('/api/v1/auth/phone/verify').send({ phone: mobile, mode: 'signup', code })).status).toBe(400);
  });

  it('logs in by OTP, and refuses unknown or duplicate numbers', async () => {
    await clearCooldowns(e164);
    expect((await request(app).post('/api/v1/auth/phone/send-otp').send({ phone: mobile, mode: 'signup', name: 'Again' })).status).toBe(409);
    const unknown = await request(app).post('/api/v1/auth/phone/send-otp').send({ phone: randomMobile(), mode: 'login' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.details.code).toBe('USER_NOT_FOUND');
    expect((await request(app).post('/api/v1/auth/phone/send-otp').send({ phone: '12345', mode: 'login' })).status).toBe(422);

    expect((await request(app).post('/api/v1/auth/phone/send-otp').send({ phone: mobile, mode: 'login' })).status).toBe(200);
    const code = await pinCode('phone-login', e164);
    const res = await request(app).post('/api/v1/auth/phone/verify').send({ phone: mobile, mode: 'login', code });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userId);
  });

  it('burns a code after five wrong guesses', async () => {
    await clearCooldowns(e164);
    await request(app).post('/api/v1/auth/phone/send-otp').send({ phone: mobile, mode: 'login' });
    for (let i = 0; i < 4; i++) await request(app).post('/api/v1/auth/phone/verify').send({ phone: mobile, mode: 'login', code: '111111' });
    const fifth = await request(app).post('/api/v1/auth/phone/verify').send({ phone: mobile, mode: 'login', code: '111111' });
    expect(fifth.body.error.details.code).toBe('OTP_BURNED');
  });

  it('adds a verified email and fills in the rest of the profile', async () => {
    const token = signAccessToken({ sub: userId, role: Role.USER });
    const email = uniqueTestEmail('phone-email');
    extraEmails.push(email);

    expect((await request(app).post('/api/v1/users/me/email/send-otp').set('Authorization', `Bearer ${token}`).send({ email })).status).toBe(200);
    const code = await pinCode('change-email', email);
    const verified = await request(app).post('/api/v1/users/me/email/verify').set('Authorization', `Bearer ${token}`).send({ email, code });
    expect(verified.body.user).toMatchObject({ email, isEmailVerified: true });

    const profile = await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        dateOfBirth: '1998-05-20',
        bloodGroup: 'B+',
        alternatePhone: '98765 00001',
        addressLine1: '12 MG Road',
        city: 'Indore',
        state: 'Madhya Pradesh',
        postalCode: '452001',
        country: 'India',
        injuries: ['Left knee ACL', 'Left knee ACL', ' '],
        medicalConditions: ['Asthma'],
      });
    expect(profile.status).toBe(200);
    expect(profile.body.user).toMatchObject({ bloodGroup: 'B+', alternatePhone: '+919876500001', city: 'Indore', injuries: ['Left knee ACL'], hasGoogle: false });
    expect(profile.body.user.age).toBeGreaterThanOrEqual(27);

    const bad = await request(app).patch('/api/v1/users/me/profile').set('Authorization', `Bearer ${token}`).send({ bloodGroup: 'Z+', dateOfBirth: '2030-01-01' });
    expect(bad.status).toBe(422);
  });

  it("won't take another account's number or email, and keeps a way to log in", async () => {
    const other = await prisma.user.create({ data: { email: uniqueTestEmail('phone-other'), role: Role.USER, isEmailVerified: true } });
    extraEmails.push(other.email!);
    const otherToken = signAccessToken({ sub: other.id, role: Role.USER });
    const taken = await request(app).post('/api/v1/users/me/phone/send-otp').set('Authorization', `Bearer ${otherToken}`).send({ phone: mobile });
    expect(taken.status).toBe(409);

    // The phone account now has an email too, so the number can be removed...
    const token = signAccessToken({ sub: userId, role: Role.USER });
    expect((await request(app).delete('/api/v1/users/me/phone').set('Authorization', `Bearer ${token}`)).status).toBe(200);
    // ...but a member with only a number couldn't remove it.
    const onlyPhone = await prisma.user.create({ data: { phone: `+91${randomMobile()}`, isPhoneVerified: true, role: Role.USER } });
    const res = await request(app).delete('/api/v1/users/me/phone').set('Authorization', `Bearer ${signAccessToken({ sub: onlyPhone.id, role: Role.USER })}`);
    expect(res.status).toBe(409);
    await prisma.user.delete({ where: { id: onlyPhone.id } });
    await deleteTestUser(other.email!);
  });

  it('reports which sign-in methods are available', async () => {
    const res = await request(app).get('/api/v1/auth/methods');
    expect(res.body).toMatchObject({ email: true, phone: true });
  });
});
