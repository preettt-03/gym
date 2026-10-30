import crypto from 'crypto';
import { NotificationType, Prisma, RedemptionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/config/logger';
import { AppError } from '@/middlewares/errorHandler';
import { createNotification } from '@/features/notifications/notifications.service';

// No 0/O/1/I so codes read cleanly over the front desk.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function redemptionCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export interface RewardItemInput {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  costCoins: number;
  stock?: number | null;
  maxPerMember?: number | null;
  isActive?: boolean;
  sortOrder?: number;
}

const ACTIVE_STATUSES = [RedemptionStatus.PENDING, RedemptionStatus.FULFILLED];

// --- Member side ---

export async function getStore(userId: string) {
  const [user, items, mine] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { coins: true, xp: true } }),
    prisma.rewardItem.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { costCoins: 'asc' }] }),
    prisma.rewardRedemption.groupBy({ by: ['itemId'], where: { userId, status: { in: ACTIVE_STATUSES } }, _count: true }),
  ]);
  const taken = new Map(mine.map((m) => [m.itemId, m._count]));
  return {
    coins: user.coins,
    xp: user.xp,
    items: items.map((item) => {
      const redeemedByMe = taken.get(item.id) ?? 0;
      const reason =
        item.stock !== null && item.stock <= 0
          ? 'OUT_OF_STOCK'
          : item.maxPerMember !== null && redeemedByMe >= item.maxPerMember
            ? 'LIMIT_REACHED'
            : user.coins < item.costCoins
              ? 'NOT_ENOUGH_COINS'
              : null;
      return { ...item, redeemedByMe, canRedeem: reason === null, blockedReason: reason };
    }),
  };
}

/**
 * Spends coins on an item. Coins and stock are taken with conditional updates
 * inside one transaction, so two quick taps (or two members racing for the last
 * one) can never overdraw a wallet or oversell stock.
 */
export async function redeem(userId: string, itemId: string) {
  const item = await prisma.rewardItem.findFirst({ where: { id: itemId, isActive: true } });
  if (!item) throw new AppError('This reward is no longer available', 404);

  const redemption = await prisma.$transaction(async (tx) => {
    if (item.maxPerMember !== null) {
      const already = await tx.rewardRedemption.count({ where: { userId, itemId, status: { in: ACTIVE_STATUSES } } });
      if (already >= item.maxPerMember) throw new AppError(`You can redeem this reward ${item.maxPerMember} time(s) at most`, 409);
    }
    const paid = await tx.user.updateMany({ where: { id: userId, coins: { gte: item.costCoins } }, data: { coins: { decrement: item.costCoins } } });
    if (!paid.count) throw new AppError('Not enough coins for this reward', 422);
    if (item.stock !== null) {
      const taken = await tx.rewardItem.updateMany({ where: { id: itemId, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } });
      if (!taken.count) throw new AppError('Sorry — this reward just sold out', 409);
    }
    return tx.rewardRedemption.create({
      data: { userId, itemId, coins: item.costCoins, code: redemptionCode() },
      include: { item: true },
    });
  });

  await createNotification(userId, NotificationType.REWARD, `Redeemed: ${item.name}`, `Show code ${redemption.code} at the front desk to collect it.`, {
    link: '/rewards',
    redemptionId: redemption.id,
  }).catch((err) => logger.error('Redemption notification failed', { err }));
  return redemption;
}

export async function listMyRedemptions(userId: string) {
  return prisma.rewardRedemption.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { item: { select: { id: true, name: true, imageUrl: true } } },
  });
}

/** Undo a pending redemption: coins back to the member, item back in stock. */
async function cancelRedemption(id: string, where: Prisma.RewardRedemptionWhereInput, note?: string) {
  const redemption = await prisma.$transaction(async (tx) => {
    const found = await tx.rewardRedemption.findFirst({ where: { id, ...where }, include: { item: true } });
    if (!found) throw new AppError('Redemption not found', 404);
    const flipped = await tx.rewardRedemption.updateMany({
      where: { id, status: RedemptionStatus.PENDING },
      data: { status: RedemptionStatus.CANCELLED, cancelledAt: new Date(), note: note ?? found.note },
    });
    if (!flipped.count) throw new AppError('Only pending redemptions can be cancelled', 409);
    await tx.user.update({ where: { id: found.userId }, data: { coins: { increment: found.coins } } });
    if (found.item.stock !== null) await tx.rewardItem.update({ where: { id: found.itemId }, data: { stock: { increment: 1 } } });
    return found;
  });
  return redemption;
}

export async function cancelMyRedemption(userId: string, id: string) {
  await cancelRedemption(id, { userId });
}

// --- Admin side ---

export async function listItems() {
  const [items, counts] = await Promise.all([
    prisma.rewardItem.findMany({ orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { costCoins: 'asc' }] }),
    prisma.rewardRedemption.groupBy({ by: ['itemId', 'status'], _count: true }),
  ]);
  return items.map((item) => {
    const of = (status: RedemptionStatus) => counts.find((c) => c.itemId === item.id && c.status === status)?._count ?? 0;
    return { ...item, pending: of(RedemptionStatus.PENDING), fulfilled: of(RedemptionStatus.FULFILLED) };
  });
}

export async function createItem(input: RewardItemInput) {
  return prisma.rewardItem.create({ data: input });
}

export async function updateItem(id: string, input: Partial<RewardItemInput>) {
  const found = await prisma.rewardItem.findUnique({ where: { id } });
  if (!found) throw new AppError('Reward not found', 404);
  return prisma.rewardItem.update({ where: { id }, data: input });
}

/** Deletes an unused item; one with redemptions is archived so its history stays. */
export async function deleteItem(id: string) {
  const found = await prisma.rewardItem.findUnique({ where: { id }, include: { _count: { select: { redemptions: true } } } });
  if (!found) throw new AppError('Reward not found', 404);
  if (found._count.redemptions > 0) {
    await prisma.rewardItem.update({ where: { id }, data: { isActive: false } });
    return { archived: true };
  }
  await prisma.rewardItem.delete({ where: { id } });
  return { archived: false };
}

export async function listRedemptions(filter: { status?: RedemptionStatus; code?: string; page: number; limit: number }) {
  const where: Prisma.RewardRedemptionWhereInput = {
    ...(filter.status && { status: filter.status }),
    ...(filter.code && { code: { contains: filter.code.trim().toUpperCase() } }),
  };
  const [items, total] = await Promise.all([
    prisma.rewardRedemption.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
      include: {
        item: { select: { id: true, name: true, imageUrl: true } },
        user: { select: { id: true, name: true, email: true, phone: true, photoUrl: true } },
      },
    }),
    prisma.rewardRedemption.count({ where }),
  ]);
  return { items, pagination: { page: filter.page, limit: filter.limit, total, totalPages: Math.ceil(total / filter.limit) } };
}

export async function fulfillRedemption(adminId: string, id: string, note?: string) {
  const found = await prisma.rewardRedemption.findUnique({ where: { id }, include: { item: true } });
  if (!found) throw new AppError('Redemption not found', 404);
  const flipped = await prisma.rewardRedemption.updateMany({
    where: { id, status: RedemptionStatus.PENDING },
    data: { status: RedemptionStatus.FULFILLED, fulfilledAt: new Date(), fulfilledById: adminId, note: note ?? found.note },
  });
  if (!flipped.count) throw new AppError('Only pending redemptions can be marked as given', 409);
  await createNotification(found.userId, NotificationType.REWARD, `Enjoy your ${found.item.name}! 🎉`, 'Your reward was handed over at the front desk.', {
    link: '/rewards',
    redemptionId: id,
  }).catch((err) => logger.error('Fulfil notification failed', { err }));
}

export async function adminCancelRedemption(id: string, note?: string) {
  const found = await cancelRedemption(id, {}, note);
  await createNotification(
    found.userId,
    NotificationType.REWARD,
    `Redemption cancelled: ${found.item.name}`,
    `${found.coins} coins were returned to your wallet.${note ? ` Note: ${note}` : ''}`,
    { link: '/rewards', redemptionId: id }
  ).catch((err) => logger.error('Cancel notification failed', { err }));
}
