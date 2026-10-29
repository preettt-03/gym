"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, Trash2 } from "lucide-react";
import { deleteNutritionLog, getDailyNutrition, logFood, searchFoods } from "@/lib/diet-api";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/require-auth";
import { SkeletonList } from "@/components/ui/skeleton";

function FoodSearch() {
  const [search, setSearch] = useState("");
  const [grams, setGrams] = useState<Record<string, number>>({});
  const queryClient = useQueryClient();

  const { data: results } = useQuery({
    queryKey: ["food-search", search],
    queryFn: () => searchFoods(search),
    enabled: search.trim().length >= 2,
  });

  const logMutation = useMutation({
    mutationFn: logFood,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["daily-nutrition"] }),
  });

  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>Log a food</CardTitle>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Search food database..."
          className="pl-11"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {search.trim().length >= 2 && (
        <div className="flex flex-col gap-2">
          {results?.length === 0 && <p className="text-sm text-muted">No matching foods.</p>}
          {results?.map((food) => (
            <div key={food.id} className="glass-input flex items-center justify-between gap-3 px-4 py-2.5">
              <div>
                <div className="text-sm font-medium">{food.name}</div>
                <div className="text-xs text-muted">{food.caloriesPer100g} kcal / 100g</div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  className="h-9 w-20 px-3 text-sm"
                  value={grams[food.id] ?? 100}
                  onChange={(e) => setGrams((g) => ({ ...g, [food.id]: Number(e.target.value) }))}
                />
                <span className="text-xs text-muted">g</span>
                <Button
                  size="sm"
                  disabled={logMutation.isPending}
                  onClick={() =>
                    logMutation.mutate({ foodId: food.id, quantityGrams: grams[food.id] ?? 100 })
                  }
                >
                  Add
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function TotalsBar({ totals }: { totals: { calories: number; protein: number; carbs: number; fat: number } }) {
  const items = [
    { label: "Calories", value: `${Math.round(totals.calories)} kcal` },
    { label: "Protein", value: `${totals.protein}g` },
    { label: "Carbs", value: `${totals.carbs}g` },
    { label: "Fat", value: `${totals.fat}g` },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="text-center">
          <div className="text-xs text-muted">{item.label}</div>
          <div className="mt-1 text-xl font-semibold">{item.value}</div>
        </Card>
      ))}
    </div>
  );
}

function DailyLog() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["daily-nutrition"], queryFn: () => getDailyNutrition() });

  const removeMutation = useMutation({
    mutationFn: deleteNutritionLog,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["daily-nutrition"] }),
  });

  if (isLoading) return <SkeletonList rows={2} />;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <TotalsBar totals={data.totals} />

      <Card>
        <CardTitle>Today&apos;s entries</CardTitle>
        {data.entries.length === 0 ? (
          <CardDescription className="mt-2">Nothing logged yet today.</CardDescription>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {data.entries.map((entry) => (
              <div key={entry.id} className="glass-input flex items-center justify-between px-4 py-2.5">
                <div>
                  <div className="text-sm font-medium">{entry.food.name}</div>
                  <div className="text-xs text-muted">
                    {entry.quantityGrams}g · {entry.nutrition.calories} kcal
                  </div>
                </div>
                <button
                  className="text-muted hover:text-danger"
                  onClick={() => removeMutation.mutate(entry.id)}
                  aria-label="Remove entry"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function NutritionContent() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-semibold">
        Nutrition Calculator
      </motion.h1>
      <p className="mt-1 text-muted">Search a food, log the grams, watch your daily totals add up.</p>

      <div className="mt-8 flex flex-col gap-6">
        <FoodSearch />
        <DailyLog />
      </div>
    </div>
  );
}

export default function NutritionPage() {
  return (
    <RequireAuth>
      <NutritionContent />
    </RequireAuth>
  );
}
