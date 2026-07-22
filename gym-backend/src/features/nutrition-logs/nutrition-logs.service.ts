import { MealType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { scaleNutrition } from '@/lib/nutrition';

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function logFood(
  userId: string,
  foodId: string,
  quantityGrams: number,
  mealType?: MealType,
  loggedAt?: string
) {
  const food = await prisma.food.findFirst({ where: { id: foodId, deletedAt: null } });
  if (!food) throw new AppError('Food not found', 404);

  const log = await prisma.nutritionLog.create({
    data: { userId, foodId, quantityGrams, mealType, loggedAt: loggedAt ? new Date(loggedAt) : undefined },
    include: { food: true },
  });

  return { ...log, nutrition: scaleNutrition(log.food, log.quantityGrams) };
}

function roundTotals(totals: Record<string, number>) {
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Number(value.toFixed(1))]));
}

export async function listDailyLogs(userId: string, dateStr?: string) {
  const date = dateStr ? new Date(dateStr) : new Date();

  const logs = await prisma.nutritionLog.findMany({
    where: { userId, loggedAt: { gte: startOfDay(date), lte: endOfDay(date) } },
    include: { food: true },
    orderBy: { loggedAt: 'asc' },
  });

  const entries = logs.map((log) => ({ ...log, nutrition: scaleNutrition(log.food, log.quantityGrams) }));

  const totals = entries.reduce(
    (acc, entry) => ({
      calories: acc.calories + entry.nutrition.calories,
      protein: acc.protein + entry.nutrition.protein,
      carbs: acc.carbs + entry.nutrition.carbs,
      fat: acc.fat + entry.nutrition.fat,
      fiber: acc.fiber + (entry.nutrition.fiber ?? 0),
      sugar: acc.sugar + (entry.nutrition.sugar ?? 0),
      sodiumMg: acc.sodiumMg + (entry.nutrition.sodiumMg ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodiumMg: 0 }
  );

  return { date: startOfDay(date).toISOString().slice(0, 10), entries, totals: roundTotals(totals) };
}

export async function deleteLog(userId: string, id: string) {
  const log = await prisma.nutritionLog.findFirst({ where: { id, userId } });
  if (!log) throw new AppError('Log not found', 404);
  await prisma.nutritionLog.delete({ where: { id } });
}
