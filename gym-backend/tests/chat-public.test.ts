import request from 'supertest';
import { prisma } from '@/lib/prisma';
import { app, deleteTestUser, getLatestOtp, uniqueTestEmail } from './helpers';

describe('Public "Everyone" chat preview', () => {
  const email = uniqueTestEmail('chat-public');
  const password = 'SuperSecret123';
  let accessToken: string;
  let roomId: string;

  beforeAll(async () => {
    await request(app).post('/api/v1/auth/register').send({ email, password });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const code = await getLatestOtp(user.id);
    const verifyRes = await request(app).post('/api/v1/auth/verify-email').send({ email, code });
    accessToken = verifyRes.body.accessToken;

    const rooms = await request(app).get('/api/v1/chat/rooms').set('Authorization', `Bearer ${accessToken}`);
    roomId = rooms.body.global.id;
    await request(app)
      .post(`/api/v1/chat/rooms/${roomId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'hello from the public preview test' });
  });

  afterAll(async () => {
    await prisma.chatMessage.deleteMany({ where: { sender: { email } } });
    await deleteTestUser(email);
  });

  it('serves recent messages without logging in', async () => {
    const res = await request(app).get('/api/v1/chat/public/everyone/messages');

    expect(res.status).toBe(200);
    expect(res.body.room.id).toBe(roomId);
    expect(res.body.items.some((m: { content: string }) => m.content === 'hello from the public preview test')).toBe(true);
  });

  it('never exposes sender contact details', async () => {
    const res = await request(app).get('/api/v1/chat/public/everyone/messages');

    expect(JSON.stringify(res.body)).not.toContain(email);
    for (const m of res.body.items) expect(m.sender.email).toBeNull();
  });

  it('keeps the rest of chat behind login', async () => {
    const res = await request(app).get(`/api/v1/chat/rooms/${roomId}/messages`);
    expect(res.status).toBe(401);
  });
});
