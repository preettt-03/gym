import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { MissionInput, MissionUpdateInput } from '@/features/missions/missions.schemas';

export async function createMission(adminId: string, input: MissionInput) {
  return prisma.mission.create({
    data: {
      ...input,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      createdByAdminId: adminId,
    },
  });
}

export async function listAdminMissions() {
  return prisma.mission.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } });
}

export async function updateMission(id: string, data: MissionUpdateInput) {
  const mission = await prisma.mission.findUnique({ where: { id } });
  if (!mission || mission.deletedAt) throw new AppError('Mission not found', 404);

  return prisma.mission.update({
    where: { id },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
  });
}

export async function deleteMission(id: string) {
  const mission = await prisma.mission.findUnique({ where: { id } });
  if (!mission || mission.deletedAt) throw new AppError('Mission not found', 404);
  await prisma.mission.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
}

export async function listActiveMissionsForUser(userId: string) {
  const now = new Date();
  const missions = await prisma.mission.findMany({
    where: { isActive: true, deletedAt: null, startDate: { lte: now }, endDate: { gte: now } },
    orderBy: { endDate: 'asc' },
  });

  const progress = await prisma.userMissionProgress.findMany({
    where: { userId, missionId: { in: missions.map((m) => m.id) } },
  });
  const progressByMission = new Map(progress.map((p) => [p.missionId, p]));

  return missions.map((mission) => ({
    ...mission,
    progress: progressByMission.get(mission.id) ?? { currentValue: 0, isCompleted: false, completedAt: null },
  }));
}

export async function reportProgress(userId: string, missionId: string, value: number) {
  const mission = await prisma.mission.findFirst({ where: { id: missionId, isActive: true, deletedAt: null } });
  if (!mission) throw new AppError('Mission not found', 404);

  const now = new Date();
  if (now < mission.startDate || now > mission.endDate) {
    throw new AppError('Mission is not currently active', 400);
  }

  // Increment in the database so concurrent reports can't overwrite each other.
  const increment = () =>
    prisma.userMissionProgress.upsert({
      where: { userId_missionId: { userId, missionId } },
      update: { currentValue: { increment: value } },
      create: { userId, missionId, currentValue: value },
    });
  // Two first-ever reports can race on the create; the loser retries as an update.
  const progress = await increment().catch((err) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return increment();
    throw err;
  });
  if (progress.isCompleted || progress.currentValue < mission.targetValue) return progress;

  // Exactly one request can flip isCompleted, so the reward is paid once even
  // when two reports cross the target at the same moment.
  const { count } = await prisma.userMissionProgress.updateMany({
    where: { userId, missionId, isCompleted: false },
    data: { isCompleted: true, completedAt: now },
  });
  if (count === 1) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { coins: { increment: mission.rewardCoins }, xp: { increment: mission.rewardXp } },
      }),
      ...(mission.rewardBadgeId
        ? [
            prisma.userBadge.upsert({
              where: { userId_badgeId: { userId, badgeId: mission.rewardBadgeId } },
              update: {},
              create: { userId, badgeId: mission.rewardBadgeId },
            }),
          ]
        : []),
    ]);
  }

  return prisma.userMissionProgress.findUniqueOrThrow({ where: { userId_missionId: { userId, missionId } } });
}
