import { Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { SegmentRules } from '@/features/segments/segments.schemas';
import { assignPlan as assignWorkoutPlan } from '@/features/workout-plans/workout-plans.service';
import { assignDietPlan } from '@/features/diet-plans/diet-plans.service';
import { broadcastAnnouncement } from '@/features/notifications/notifications.service';

async function resolveSegmentUsers(rules: SegmentRules) {
  const where: Prisma.UserWhereInput = { deletedAt: null, role: Role.USER };
  if (rules.fitnessGoal) where.fitnessGoal = rules.fitnessGoal;
  if (rules.experienceLevel) where.experienceLevel = rules.experienceLevel;
  if (rules.gender) where.gender = rules.gender;
  if (rules.ageMin !== undefined || rules.ageMax !== undefined) {
    where.age = { gte: rules.ageMin, lte: rules.ageMax };
  }

  let users = await prisma.user.findMany({
    where,
    select: { id: true, email: true, name: true, age: true, weightKg: true, heightCm: true },
  });

  if (rules.bmiMin !== undefined || rules.bmiMax !== undefined) {
    users = users.filter((u) => {
      if (!u.weightKg || !u.heightCm) return false;
      const bmi = u.weightKg / (u.heightCm / 100) ** 2;
      if (rules.bmiMin !== undefined && bmi < rules.bmiMin) return false;
      if (rules.bmiMax !== undefined && bmi > rules.bmiMax) return false;
      return true;
    });
  }

  if (rules.membershipStatus) {
    const userIds = users.map((u) => u.id);
    const memberships = await prisma.membership.findMany({
      where: { userId: { in: userIds } },
      orderBy: { endDate: 'desc' },
    });
    const latestByUser = new Map<string, (typeof memberships)[number]>();
    for (const m of memberships) {
      if (!latestByUser.has(m.userId)) latestByUser.set(m.userId, m);
    }
    users = users.filter((u) => {
      const latest = latestByUser.get(u.id);
      if (rules.membershipStatus === 'NONE') return !latest;
      if (!latest) return false;
      const isActive = latest.status === 'ACTIVE' && latest.endDate >= new Date();
      if (rules.membershipStatus === 'ACTIVE') return isActive;
      return !isActive; // EXPIRED
    });
  }

  if (rules.inactiveDays !== undefined) {
    const cutoff = new Date(Date.now() - rules.inactiveDays * 24 * 60 * 60 * 1000);
    const userIds = users.map((u) => u.id);
    const recentAttendance = await prisma.attendance.findMany({
      where: { userId: { in: userIds }, checkInAt: { gte: cutoff } },
      select: { userId: true },
      distinct: ['userId'],
    });
    const activeUserIds = new Set(recentAttendance.map((a) => a.userId));
    users = users.filter((u) => !activeUserIds.has(u.id));
  }

  return users;
}

export async function createSegment(
  adminId: string,
  name: string,
  description: string | undefined,
  rules: SegmentRules
) {
  return prisma.segment.create({
    data: { name, description, rules: rules as Prisma.InputJsonValue, createdByAdminId: adminId },
  });
}

export async function listSegments() {
  return prisma.segment.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getSegment(id: string) {
  const segment = await prisma.segment.findUnique({ where: { id } });
  if (!segment) throw new AppError('Segment not found', 404);
  return segment;
}

export async function deleteSegment(id: string) {
  const segment = await prisma.segment.findUnique({ where: { id } });
  if (!segment) throw new AppError('Segment not found', 404);
  await prisma.segment.delete({ where: { id } });
}

export async function previewSegment(id: string) {
  const segment = await getSegment(id);
  const users = await resolveSegmentUsers(segment.rules as SegmentRules);
  return { count: users.length, sample: users.slice(0, 20) };
}

export async function assignWorkoutPlanToSegment(segmentId: string, planId: string) {
  const segment = await getSegment(segmentId);
  const users = await resolveSegmentUsers(segment.rules as SegmentRules);
  await assignWorkoutPlan(
    planId,
    users.map((u) => u.id)
  );
  return { assignedCount: users.length };
}

export async function assignDietPlanToSegment(segmentId: string, planId: string) {
  const segment = await getSegment(segmentId);
  const users = await resolveSegmentUsers(segment.rules as SegmentRules);
  await assignDietPlan(
    planId,
    users.map((u) => u.id)
  );
  return { assignedCount: users.length };
}

export async function notifySegment(segmentId: string, title: string, body: string | undefined) {
  const segment = await getSegment(segmentId);
  const users = await resolveSegmentUsers(segment.rules as SegmentRules);
  return broadcastAnnouncement(
    title,
    body,
    users.map((u) => u.id)
  );
}
