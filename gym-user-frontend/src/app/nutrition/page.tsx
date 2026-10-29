"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ChevronLeft, ChevronRight, Flame, Loader2, Plus, Search, Trash2, UtensilsCrossed } from "lucide-react";
import { getDashboard } from "@/lib/api";
import {
  deleteNutritionLog,
  getDailyNutrition,
  logFood,
  MEAL_LABELS,
  MEAL_ORDER,
  searchFoods,
  type Food,
  type MealType,
  type NutritionLogEntry,
} from "@/lib/diet-api";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorNote, MemberHeader, MemberPage, Meter, Panel } from "@/components/member/ui";

const TZ = "Asia/Kolkata";
// "YYYY-MM-DD" for an IST calendar day.
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const shiftDay = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + days);
  return dayKey(d);
};
const dayLabel = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: TZ });

// Default meal for "now" so the picker usually starts on the right one.
function mealForNow(): MealType {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: TZ }).format(new Date()));
  if (hour < 11) return "BREAKFAST";
  if (hour < 16) return "LUNCH";
  if (hour < 19) return "SNACKS";
  return "DINNER";
}

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return v;
}

function FoodRow({ food, day, isToday }: { food: Food; day: string; isToday: boolean }) {
  const queryClient = useQueryClient();
  const [grams, setGrams] = useState("100");
  const [meal, setMeal] = useState<MealType>(mealForNow);
  const qty = Number(grams);
  const valid = Number.isFinite(qty) && qty > 0 && qty <= 5000;
  const f = valid ? qty / 100 : 0;

  const add = useMutation({
    mutationFn: () =>
      logFood({
        foodId: food.id,
        quantityGrams: qty,
        mealType: meal,
        // Back-filled days are stamped at noon IST so they land on the right date.
        ...(isToday ? {} : { loggedAt: new Date(`${day}T12:00:00+05:30`).toISOString() }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["daily-nutrition"] }),
  });

  return (
    <li className="flex flex-col gap-3 rounded-xl bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium">{food.name}</p>
        <p className="text-xs text-muted">
          {valid
            ? `${Math.round(food.caloriesPer100g * f)} kcal · P ${+(food.proteinPer100g * f).toFixed(1)} g · C ${+(food.carbsPer100g * f).toFixed(1)} g · F ${+(food.fatPer100g * f).toFixed(1)} g`
            : `${food.caloriesPer100g} kcal per 100 g`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`grams-${food.id}`}>
          Grams of {food.name}
        </label>
        <div className="relative">
          <Input
            id={`grams-${food.id}`}
            inputMode="decimal"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            aria-invalid={!valid ? true : undefined}
            className="h-10 w-24 pr-7"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">g</span>
        </div>
        <label className="sr-only" htmlFor={`meal-${food.id}`}>
          Meal
        </label>
        <Select
          id={`meal-${food.id}`}
          className="h-10 w-36 px-3"
          value={meal}
          onChange={(v) => setMeal(v as MealType)}
          options={MEAL_ORDER.map((m) => ({ value: m, label: MEAL_LABELS[m] }))}
        />
        <Button size="sm" className="h-10" disabled={!valid || add.isPending} onClick={() => add.mutate()} aria-label={`Add ${food.name}`}>
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : add.isSuccess ? "Added ✓" : <Plus className="h-4 w-4" />}
          {!add.isPending && !add.isSuccess && "Add"}
        </Button>
      </div>
      {!valid && <p className="text-xs text-danger sm:hidden">Enter 1–5,000 g</p>}
      {add.isError && (
        <p role="alert" className="text-xs text-danger">
          {isAxiosError(add.error) ? add.error.response?.data?.error?.message ?? "Couldn't add" : "Couldn't add"}
        </p>
      )}
    </li>
  );
}

function EntryRow({ entry }: { entry: NutritionLogEntry }) {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const remove = useMutation({
    mutationFn: () => deleteNutritionLog(entry.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["daily-nutrition"] }),
  });
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{entry.food.name}</p>
        <p className="text-xs text-muted">
          {entry.quantityGrams} g · P {Math.round(entry.nutrition.protein)} g · C {Math.round(entry.nutrition.carbs)} g · F {Math.round(entry.nutrition.fat)} g
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold tabular-nums">{Math.round(entry.nutrition.calories)} kcal</span>
        {confirm ? (
          <>
            <Button size="sm" variant="destructive" className="h-8" disabled={remove.isPending} onClick={() => remove.mutate()}>
              Remove
            </Button>
            <Button size="sm" variant="glass" className="h-8" onClick={() => setConfirm(false)}>
              Keep
            </Button>
          </>
        ) : (
          <button type="button" className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger" onClick={() => setConfirm(true)} aria-label={`Remove ${entry.food.name}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </li>
  );
}

function NutritionContent() {
  const [today] = useState(() => dayKey(new Date()));
  const [day, setDay] = useState(today);
  const [search, setSearch] = useState("");
  const term = useDebounced(search.trim());
  const isToday = day === today;

  const log = useQuery({ queryKey: ["daily-nutrition", ...(isToday ? [] : [day])], queryFn: () => getDailyNutrition(isToday ? undefined : day) });
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });
  const foods = useQuery({ queryKey: ["food-search", term], queryFn: () => searchFoods(term), enabled: term.length >= 2 });

  const need = dashboard.data?.metrics.calorieNeeds ?? 0;
  const totals = log.data?.totals;
  const byMeal = MEAL_ORDER.map((m) => ({ meal: m, entries: log.data?.entries.filter((e) => e.mealType === m) ?? [] }));
  const unsorted = log.data?.entries.filter((e) => !e.mealType) ?? [];

  return (
    <MemberPage>
      <MemberHeader
        eyebrow="Nutrition"
        title="Food log"
        description="Search our food database, log what you ate and watch your daily totals add up."
        actions={
          <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Previous day" onClick={() => setDay((d) => shiftDay(d, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-36 px-2 text-center text-sm font-medium">{isToday ? "Today" : dayLabel.format(new Date(`${day}T12:00:00+05:30`))}</span>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Next day" disabled={isToday} onClick={() => setDay((d) => shiftDay(d, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-4">
          <Panel icon={Flame} title={isToday ? "Today's totals" : "Day totals"}>
            {log.isPending ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : totals ? (
              <>
                <p className="text-4xl font-semibold">
                  {Math.round(totals.calories)}
                  <span className="text-lg text-muted"> {need ? `/ ${Math.round(need)} kcal` : "kcal"}</span>
                </p>
                {need > 0 && (
                  <div className="mt-3">
                    <Meter value={totals.calories} max={need} label="Calories eaten vs daily need" />
                    <p className="mt-1.5 text-xs text-muted">
                      {totals.calories > need ? `${Math.round(totals.calories - need)} kcal over your estimated need` : `${Math.round(need - totals.calories)} kcal left`}
                    </p>
                  </div>
                )}
                <dl className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                  {(
                    [
                      ["Protein", totals.protein],
                      ["Carbs", totals.carbs],
                      ["Fat", totals.fat],
                    ] as const
                  ).map(([label, grams]) => (
                    <div key={label} className="flex flex-col-reverse rounded-lg bg-surface-2 py-3">
                      <dt className="text-muted">{label}</dt>
                      <dd className="text-lg font-semibold">{Math.round(grams)} g</dd>
                    </div>
                  ))}
                </dl>
                {!need && (
                  <p className="mt-3 text-xs text-muted">
                    Add your age, height and weight in{" "}
                    <Link href="/settings" className="text-gold hover:underline">
                      settings
                    </Link>{" "}
                    to see your daily calorie need.
                  </p>
                )}
              </>
            ) : null}
          </Panel>

          <Panel icon={Search} title="Add food">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                type="search"
                aria-label="Search food database"
                placeholder="Search food database..."
                className="pl-11"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {!isToday && <p className="mt-2 text-xs text-muted">Adding to {dayLabel.format(new Date(`${day}T12:00:00+05:30`))}.</p>}
            <div className="mt-4">
              {term.length < 2 && <p className="text-sm text-muted">Type at least 2 letters, e.g. &ldquo;roti&rdquo; or &ldquo;paneer&rdquo;.</p>}
              {foods.isFetching && term.length >= 2 && <Skeleton className="h-16 rounded-xl" />}
              {foods.data?.length === 0 && !foods.isFetching && <p className="text-sm text-muted">No foods match &ldquo;{term}&rdquo;. Ask the gym to add it.</p>}
              {foods.data && foods.data.length > 0 && !foods.isFetching && (
                <ul className="flex flex-col gap-2">
                  {foods.data.slice(0, 10).map((f) => (
                    <FoodRow key={f.id} food={f} day={day} isToday={isToday} />
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        </div>

        <Panel icon={UtensilsCrossed} title="Meals">
          {log.isPending && <Skeleton className="h-64 rounded-xl" />}
          {log.isError && <ErrorNote>Could not load this day&apos;s log.</ErrorNote>}
          {log.data && log.data.entries.length === 0 && (
            <EmptyState icon={UtensilsCrossed} title="Nothing logged yet" description="Search for a food on the left to add your first meal." />
          )}
          {log.data && log.data.entries.length > 0 && (
            <div className="flex flex-col gap-5">
              {[...byMeal, { meal: null, entries: unsorted }]
                .filter((g) => g.entries.length > 0)
                .map((g) => {
                  const kcal = g.entries.reduce((s, e) => s + e.nutrition.calories, 0);
                  return (
                    <section key={g.meal ?? "other"} aria-label={g.meal ? MEAL_LABELS[g.meal] : "Other"}>
                      <div className="flex items-center justify-between border-b border-border pb-2">
                        <h3 className="text-sm font-semibold uppercase tracking-widest text-gold">{g.meal ? MEAL_LABELS[g.meal] : "Other"}</h3>
                        <span className="text-xs text-muted">{Math.round(kcal)} kcal</span>
                      </div>
                      <ul className="divide-y divide-border">
                        {g.entries.map((e) => (
                          <EntryRow key={e.id} entry={e} />
                        ))}
                      </ul>
                    </section>
                  );
                })}
            </div>
          )}
          <p className="mt-6 text-xs text-muted">Values are estimates from our food database.</p>
        </Panel>
      </div>
    </MemberPage>
  );
}

export default function NutritionPage() {
  return (
    <RequireAuth>
      <NutritionContent />
    </RequireAuth>
  );
}
