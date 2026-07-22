import request from 'supertest';
import { app } from './helpers';

describe('GET /api/v1/health', () => {
  it('reports database and redis connectivity', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.services.database).toBe(true);
    expect(res.body.services.redis).toBe(true);
  });
});
