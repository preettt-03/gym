interface FoodNutrition {
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number | null;
  sugarPer100g: number | null;
  sodiumMgPer100g: number | null;
}

export function scaleNutrition(food: FoodNutrition, grams: number) {
  const factor = grams / 100;
  return {
    calories: Number((food.caloriesPer100g * factor).toFixed(1)),
    protein: Number((food.proteinPer100g * factor).toFixed(1)),
    carbs: Number((food.carbsPer100g * factor).toFixed(1)),
    fat: Number((food.fatPer100g * factor).toFixed(1)),
    fiber: food.fiberPer100g !== null ? Number((food.fiberPer100g * factor).toFixed(1)) : null,
    sugar: food.sugarPer100g !== null ? Number((food.sugarPer100g * factor).toFixed(1)) : null,
    sodiumMg: food.sodiumMgPer100g !== null ? Number((food.sodiumMgPer100g * factor).toFixed(1)) : null,
  };
}
