import { MealType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { scaleNutrition } from '@/lib/nutrition';
import { gymDayRange } from '@/lib/gym-time';


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
  const { dateKey, start, end } = gymDayRange(dateStr);

  const logs = await prisma.nutritionLog.findMany({
    where: { userId, loggedAt: { gte: start, lte: end } },
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

  return { date: dateKey, entries, totals: roundTotals(totals) };
}

export async function deleteLog(userId: string, id: string) {
  const log = await prisma.nutritionLog.findFirst({ where: { id, userId } });
  if (!log) throw new AppError('Log not found', 404);
  await prisma.nutritionLog.delete({ where: { id } });
}
