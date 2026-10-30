import request from 'supertest';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { app, deleteTestUser, uniqueTestEmail } from './helpers';

describe('Chat unread counts and history paging', () => {
  const emails = { reader: uniqueTestEmail('chat-reader'), writer: uniqueTestEmail('chat-writer') };
  const tokens = { reader: '', writer: '' };
  let roomId: string;
  const as = (who: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[who]}` });
  const send = (content: string) => request(app).post(`/api/v1/chat/rooms/${roomId}/messages`).set(as('writer')).send({ content });

  beforeAll(async () => {
    for (const key of Object.keys(emails) as (keyof typeof emails)[]) {
      const u = await prisma.user.create({ data: { email: emails[key], name: `Jest ${key}`, role: Role.USER, isEmailVerified: true } });
      tokens[key] = signAccessToken({ sub: u.id, role: Role.USER });
    }
    roomId = (await request(app).get('/api/v1/chat/rooms').set(as('reader'))).body.global.id;
  });

  afterAll(async () => {
    await prisma.chatMessage.deleteMany({ where: { sender: { email: { in: Object.values(emails) } } } });
    for (const email of Object.values(emails)) await deleteTestUser(email);
  });

  it('counts messages from others since the member last read the room', async () => {
    const before = (await request(app).get('/api/v1/chat/unread').set(as('reader'))).body.rooms[roomId] ?? 0;
    for (const n of [1, 2, 3]) await send(`unread ${n}`);

    const unread = await request(app).get('/api/v1/chat/unread').set(as('reader'));
    expect(unread.status).toBe(200);
    expect(unread.body.rooms[roomId]).toBe(before + 3);
    expect(unread.body.total).toBeGreaterThanOrEqual(3);

    // The writer's own messages never count as unread for them.
    const own = await request(app).get('/api/v1/chat/unread').set(as('writer'));
    const history = await request(app).get(`/api/v1/chat/rooms/${roomId}/messages`).set(as('reader'));
    const last = history.body.items[history.body.items.length - 1];
    expect(own.body.rooms[roomId]).toBeLessThan(unread.body.rooms[roomId]);

    expect((await request(app).post(`/api/v1/chat/rooms/${roomId}/read`).set(as('reader')).send({ messageId: last.id })).status).toBe(200);
    expect((await request(app).get('/api/v1/chat/unread').set(as('reader'))).body.rooms[roomId]).toBe(0);
  });

  it('pages back through older messages with a cursor, without gaps or repeats', async () => {
    for (const n of [1, 2, 3, 4, 5]) await send(`page ${n}`);

    const newest = await request(app).get(`/api/v1/chat/rooms/${roomId}/messages?limit=3`).set(as('reader'));
    expect(newest.body.hasMore).toBe(true);
    expect(newest.body.items.map((m: { content: string }) => m.content)).toEqual(['page 3', 'page 4', 'page 5']);

    const older = await request(app).get(`/api/v1/chat/rooms/${roomId}/messages?limit=3&before=${newest.body.items[0].id}`).set(as('reader'));
    expect(older.status).toBe(200);
    expect(older.body.items.map((m: { content: string }) => m.content).slice(-2)).toEqual(['page 1', 'page 2']);
  });
});
