import request from 'supertest';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { app, deleteTestUser, uniqueTestEmail } from './helpers';

describe('Trainer private notes and roster', () => {
  const emails = {
    coachA: uniqueTestEmail('notes-coach-a'),
    coachB: uniqueTestEmail('notes-coach-b'),
    trainee: uniqueTestEmail('notes-trainee'),
  };
  const ids = { coachA: '', coachB: '', trainee: '' };
  const tokens = { coachA: '', coachB: '', trainee: '' };
  const as = (t: string) => ({ Authorization: `Bearer ${t}` });
  let noteId: string;

  beforeAll(async () => {
    for (const key of ['coachA', 'coachB'] as const) {
      const u = await prisma.user.create({ data: { email: emails[key], role: Role.TRAINER, isEmailVerified: true } });
      ids[key] = u.id;
      tokens[key] = signAccessToken({ sub: u.id, role: Role.TRAINER });
    }
    const t = await prisma.user.create({
      data: { email: emails.trainee, name: 'Notes Trainee', role: Role.USER, isEmailVerified: true, trainerId: ids.coachA },
    });
    ids.trainee = t.id;
    tokens.trainee = signAccessToken({ sub: t.id, role: Role.USER });
    await prisma.weightLog.create({ data: { userId: t.id, weightKg: 72.5 } });
    await prisma.attendance.create({ data: { userId: t.id } });
  });

  afterAll(async () => {
    await deleteTestUser(emails.trainee);
    await deleteTestUser(emails.coachA);
    await deleteTestUser(emails.coachB);
  });

  it('roster includes recent activity signals', async () => {
    const res = await request(app).get('/api/v1/trainer/trainees').set(as(tokens.coachA));
    const row = res.body.trainees.find((t: { id: string }) => t.id === ids.trainee);
    expect(row.latestWeight.weightKg).toBe(72.5);
    expect(row.lastVisitAt).not.toBeNull();
    expect(row.workoutsLast7Days).toBe(0);
    expect(row.membership).toBeNull();
  });

  it('profile carries safety info but no account internals', async () => {
    const res = await request(app).get(`/api/v1/trainer/trainees/${ids.trainee}`).set(as(tokens.coachA));
    expect(res.body.profile).toHaveProperty('medicalConditions');
    expect(res.body.profile).not.toHaveProperty('googleId');
    expect(res.body.profile).not.toHaveProperty('passwordHash');
    expect(res.body.profile).not.toHaveProperty('accountStatus');
  });

  it('lets the coach add, edit and list private notes', async () => {
    const empty = await request(app)
      .post(`/api/v1/trainer/trainees/${ids.trainee}/private-notes`)
      .set(as(tokens.coachA))
      .send({ body: '   ' });
    expect(empty.status).toBe(422);

    const created = await request(app)
      .post(`/api/v1/trainer/trainees/${ids.trainee}/private-notes`)
      .set(as(tokens.coachA))
      .send({ body: 'Left knee pain on deep squats — keep box squats for now.' });
    expect(created.status).toBe(201);
    noteId = created.body.note.id;

    const edited = await request(app)
      .patch(`/api/v1/trainer/private-notes/${noteId}`)
      .set(as(tokens.coachA))
      .send({ body: 'Knee better; progress to full squats.' });
    expect(edited.body.note.body).toBe('Knee better; progress to full squats.');

    const list = await request(app).get(`/api/v1/trainer/trainees/${ids.trainee}/private-notes`).set(as(tokens.coachA));
    expect(list.body.notes).toHaveLength(1);
    expect(list.body.notes[0].author.id).toBe(ids.coachA);
  });

  it('keeps notes away from other trainers and from the trainee', async () => {
    const otherCoach = await request(app)
      .get(`/api/v1/trainer/trainees/${ids.trainee}/private-notes`)
      .set(as(tokens.coachB));
    expect(otherCoach.status).toBe(404);

    const trainee = await request(app)
      .get(`/api/v1/trainer/trainees/${ids.trainee}/private-notes`)
      .set(as(tokens.trainee));
    expect(trainee.status).toBe(403);
  });

  it('hands notes to a new coach on reassignment, but only the author can change them', async () => {
    await prisma.user.update({ where: { id: ids.trainee }, data: { trainerId: ids.coachB } });

    const list = await request(app).get(`/api/v1/trainer/trainees/${ids.trainee}/private-notes`).set(as(tokens.coachB));
    expect(list.body.notes).toHaveLength(1);

    const edit = await request(app)
      .patch(`/api/v1/trainer/private-notes/${noteId}`)
      .set(as(tokens.coachB))
      .send({ body: 'Overwritten' });
    expect(edit.status).toBe(404);

    // The original author no longer coaches this member, so they can't edit either.
    const formerAuthor = await request(app).delete(`/api/v1/trainer/private-notes/${noteId}`).set(as(tokens.coachA));
    expect(formerAuthor.status).toBe(404);
  });
});
