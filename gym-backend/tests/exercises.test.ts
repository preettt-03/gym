import request from 'supertest';
import { app } from './helpers';

describe('GET /api/v1/exercises', () => {
  it('is publicly readable with no auth', async () => {
    const res = await request(app).get('/api/v1/exercises');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('filters by difficulty', async () => {
    const res = await request(app).get('/api/v1/exercises').query({ difficulty: 'BEGINNER' });

    expect(res.status).toBe(200);
    for (const item of res.body.items) {
      expect(item.difficulty).toBe('BEGINNER');
    }
  });
});

describe('GET /api/v1/exercises with several difficulties', () => {
  it('returns exercises matching any of the chosen levels', async () => {
    const res = await request(app).get('/api/v1/exercises').query({ difficulty: 'BEGINNER,ADVANCED', limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) expect(['BEGINNER', 'ADVANCED']).toContain(item.difficulty);
  });

  it('rejects an unknown level', async () => {
    expect((await request(app).get('/api/v1/exercises').query({ difficulty: 'BEGINNER,EXPERT' })).status).toBe(422);
  });
});
