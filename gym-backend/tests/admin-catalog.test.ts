import request from 'supertest';
import { OtpPurpose, PlanSource, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { app, deleteTestUser, uniqueTestEmail } from './helpers';

// Food database, category management and admin-triggered password resets.
describe('Admin catalog and account tools', () => {
  const adminEmail = uniqueTestEmail('catalog-admin');
  const memberEmail = uniqueTestEmail('catalog-member');
  const tag = `jest-${Date.now()}`;
  let admin: string;
  let member: string;
  let memberId: string;
  const created = { foods: [] as string[], exerciseCategories: [] as string[], dietCategories: [] as string[] };
  let exerciseId: string;
  let dietPlanId: string;

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const food = (overrides: Record<string, unknown> = {}) => ({
    name: `${tag} Oats`,
    caloriesPer100g: 389,
    proteinPer100g: 17,
    carbsPer100g: 66,
    fatPer100g: 7,
    ...overrides,
  });

  beforeAll(async () => {
    const a = await prisma.user.create({ data: { email: adminEmail, role: Role.ADMIN, isEmailVerified: true } });
    const m = await prisma.user.create({ data: { email: memberEmail, role: Role.USER, isEmailVerified: true } });
    admin = signAccessToken({ sub: a.id, role: a.role });
    member = signAccessToken({ sub: m.id, role: m.role });
    memberId = m.id;
  });

  afterAll(async () => {
    if (exerciseId) await prisma.exercise.delete({ where: { id: exerciseId } });
    if (dietPlanId) await prisma.dietPlan.delete({ where: { id: dietPlanId } });
    await prisma.food.deleteMany({ where: { id: { in: created.foods } } });
    await prisma.exerciseCategory.deleteMany({ where: { id: { in: created.exerciseCategories } } });
    await prisma.dietCategory.deleteMany({ where: { id: { in: created.dietCategories } } });
    await deleteTestUser(memberEmail);
    await deleteTestUser(adminEmail);
  });

  describe('foods', () => {
    it('creates a food and rejects a duplicate name', async () => {
      const res = await request(app).post('/api/v1/admin/foods').set(as(admin)).send(food());
      expect(res.status).toBe(201);
      expect(res.body.food._count).toEqual({ nutritionLogs: 0, mealItems: 0 });
      created.foods.push(res.body.food.id);

      const dup = await request(app).post('/api/v1/admin/foods').set(as(admin)).send(food());
      expect(dup.status).toBe(409);
    });

    it('rejects impossible nutrition values on create and on partial update', async () => {
      const tooMuch = await request(app)
        .post('/api/v1/admin/foods')
        .set(as(admin))
        .send(food({ name: `${tag} Impossible`, proteinPer100g: 60, carbsPer100g: 60 }));
      expect(tooMuch.status).toBe(422);

      const partial = await request(app)
        .patch(`/api/v1/admin/foods/${created.foods[0]}`)
        .set(as(admin))
        .send({ fatPer100g: 50 });
      expect(partial.status).toBe(422);
    });

    it('clears an optional nutrient when it is set to null', async () => {
      const id = created.foods[0];
      await request(app).patch(`/api/v1/admin/foods/${id}`).set(as(admin)).send({ fiberPer100g: 10 });
      const res = await request(app).patch(`/api/v1/admin/foods/${id}`).set(as(admin)).send({ fiberPer100g: null });
      expect(res.status).toBe(200);
      expect(res.body.food.fiberPer100g).toBeNull();
    });

    it('returns 409 instead of crashing when a rename collides', async () => {
      const other = await request(app).post('/api/v1/admin/foods').set(as(admin)).send(food({ name: `${tag} Rice` }));
      created.foods.push(other.body.food.id);

      const res = await request(app)
        .patch(`/api/v1/admin/foods/${other.body.food.id}`)
        .set(as(admin))
        .send({ name: `${tag} Oats` });
      expect(res.status).toBe(409);
    });

    it('lists foods with usage counts for admins only', async () => {
      const res = await request(app).get('/api/v1/admin/foods').query({ search: tag }).set(as(admin));
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(2);
      expect(res.body.items[0]._count).toBeDefined();

      const denied = await request(app).get('/api/v1/admin/foods').set(as(member));
      expect(denied.status).toBe(403);
    });

    it('restores a deleted food when it is added again', async () => {
      const id = created.foods[0];
      expect((await request(app).delete(`/api/v1/admin/foods/${id}`).set(as(admin))).status).toBe(204);

      const again = await request(app).post('/api/v1/admin/foods').set(as(admin)).send(food({ caloriesPer100g: 380 }));
      expect(again.status).toBe(201);
      expect(again.body.food.id).toBe(id);
      expect(again.body.food.caloriesPer100g).toBe(380);
    });
  });

  describe('categories', () => {
    it('blocks case-insensitive duplicates and deleting an in-use exercise category', async () => {
      const res = await request(app)
        .post('/api/v1/admin/exercise-categories')
        .set(as(admin))
        .send({ name: `${tag} Strength`, description: 'Heavy lifts' });
      expect(res.status).toBe(201);
      const categoryId = res.body.category.id;
      created.exerciseCategories.push(categoryId);

      const dup = await request(app)
        .post('/api/v1/admin/exercise-categories')
        .set(as(admin))
        .send({ name: `${tag} STRENGTH` });
      expect(dup.status).toBe(409);

      const exercise = await prisma.exercise.create({
        data: {
          name: `${tag} Squat`,
          slug: `${tag}-squat`,
          targetMuscle: 'Legs',
          categories: { create: { categoryId } },
        },
      });
      exerciseId = exercise.id;

      const list = await request(app).get('/api/v1/admin/exercise-categories').set(as(admin));
      const row = list.body.categories.find((c: { id: string }) => c.id === categoryId);
      expect(row._count.exercises).toBe(1);

      const blocked = await request(app).delete(`/api/v1/admin/exercise-categories/${categoryId}`).set(as(admin));
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.message).toMatch(/used by 1 exercise/);
    });

    it('allows deleting a diet category once no live plan uses it', async () => {
      const res = await request(app)
        .post('/api/v1/admin/diet-categories')
        .set(as(admin))
        .send({ name: `${tag} Keto` });
      const categoryId = res.body.category.id;
      created.dietCategories.push(categoryId);

      const plan = await prisma.dietPlan.create({
        data: { title: `${tag} plan`, source: PlanSource.ADMIN, categories: { create: { categoryId } } },
      });
      dietPlanId = plan.id;
      expect((await request(app).delete(`/api/v1/admin/diet-categories/${categoryId}`).set(as(admin))).status).toBe(409);

      // A soft-deleted plan no longer counts as a use.
      await prisma.dietPlan.update({ where: { id: plan.id }, data: { deletedAt: new Date() } });
      expect((await request(app).delete(`/api/v1/admin/diet-categories/${categoryId}`).set(as(admin))).status).toBe(204);
    });
  });

  describe('admin-triggered password reset', () => {
    it('emails a reset code, signs the member out, and enforces a cooldown', async () => {
      await prisma.refreshToken.create({
        data: { token: `${tag}-refresh`, userId: memberId, expiresAt: new Date(Date.now() + 60_000) },
      });

      const res = await request(app).post(`/api/v1/admin/users/${memberId}/reset-password`).set(as(admin));
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(memberEmail);
      expect(res.body).not.toHaveProperty('password');

      expect(await prisma.otpCode.count({ where: { userId: memberId, purpose: OtpPurpose.PASSWORD_RESET } })).toBe(1);
      expect(await prisma.refreshToken.count({ where: { userId: memberId, revokedAt: null } })).toBe(0);

      const again = await request(app).post(`/api/v1/admin/users/${memberId}/reset-password`).set(as(admin));
      expect(again.status).toBe(429);
    });

    it("won't let an admin lock themselves out", async () => {
      const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
      const demote = await request(app)
        .patch(`/api/v1/admin/users/${adminUser.id}`)
        .set(as(admin))
        .send({ accountStatus: 'SUSPENDED' });
      expect(demote.status).toBe(400);

      const remove = await request(app).delete(`/api/v1/admin/users/${adminUser.id}`).set(as(admin));
      expect(remove.status).toBe(400);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: adminUser.id } })).deletedAt).toBeNull();
    });

    it('is admin-only and 404s for unknown users', async () => {
      const denied = await request(app).post(`/api/v1/admin/users/${memberId}/reset-password`).set(as(member));
      expect(denied.status).toBe(403);

      const missing = await request(app)
        .post('/api/v1/admin/users/00000000-0000-4000-8000-000000000000/reset-password')
        .set(as(admin));
      expect(missing.status).toBe(404);
    });
  });
});
