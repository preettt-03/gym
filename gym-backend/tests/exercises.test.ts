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
