import request from 'supertest';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { app, deleteTestUser, getLatestOtp, uniqueTestEmail } from './helpers';

// The member site and the admin panel share one host in dev, so they must not share a refresh cookie.
describe('Admin panel session isolation', () => {
  const adminEmail = uniqueTestEmail('session-admin');
  const memberEmail = uniqueTestEmail('session-member');
  const password = 'SuperSecret123';

  async function createVerified(email: string, role: Role) {
    await request(app).post('/api/v1/auth/register').send({ email, password });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await request(app).post('/api/v1/auth/verify-email').send({ email, code: await getLatestOtp(user.id) });
    await prisma.user.update({ where: { id: user.id }, data: { role } });
  }

  const cookieOf = (res: request.Response, name: string) =>
    ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${name}=`))?.split(';')[0];

  beforeAll(async () => {
    await createVerified(adminEmail, Role.ADMIN);
    await createVerified(memberEmail, Role.USER);
  });

  afterAll(async () => {
    await deleteTestUser(adminEmail);
    await deleteTestUser(memberEmail);
  });

  it('keeps the admin session when a member signs in on the same browser', async () => {
    const adminLogin = await request(app).post('/api/v1/auth/login').set('X-Client', 'admin').send({ email: adminEmail, password });
    const adminCookie = cookieOf(adminLogin, 'adminRefreshToken');
    expect(adminCookie).toBeDefined();
    expect(cookieOf(adminLogin, 'refreshToken')).toBeUndefined();

    const memberLogin = await request(app).post('/api/v1/auth/login').send({ email: memberEmail, password });
    const memberCookie = cookieOf(memberLogin, 'refreshToken');
    expect(memberCookie).toBeDefined();

    // The browser sends both cookies; the admin panel must refresh into the admin.
    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client', 'admin')
      .set('Cookie', [adminCookie!, memberCookie!].join('; '));
    expect(refreshed.status).toBe(200);

    const users = await request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${refreshed.body.accessToken}`);
    expect(users.status).toBe(200);
  });

  it('refuses a non-admin login from the admin panel', async () => {
    const res = await request(app).post('/api/v1/auth/login').set('X-Client', 'admin').send({ email: memberEmail, password });
    expect(res.status).toBe(403);
    expect(cookieOf(res, 'adminRefreshToken')).toBeUndefined();
  });

  it('ends the admin session once the account is no longer an admin', async () => {
    const login = await request(app).post('/api/v1/auth/login').set('X-Client', 'admin').send({ email: adminEmail, password });
    const cookie = cookieOf(login, 'adminRefreshToken')!;
    await prisma.user.update({ where: { email: adminEmail }, data: { role: Role.USER } });

    const res = await request(app).post('/api/v1/auth/refresh').set('X-Client', 'admin').set('Cookie', cookie);
    expect(res.status).toBe(401);
    await prisma.user.update({ where: { email: adminEmail }, data: { role: Role.ADMIN } });
  });
});
