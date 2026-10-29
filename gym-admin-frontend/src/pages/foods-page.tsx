import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { deleteFood, listManagedFoods, type ManagedFood } from "@/lib/api";
import { PageHeader, Pagination, EmptyState } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FoodFormDialog } from "@/components/food-form-dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiErrorMessage, useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const grams = (n: number) => `${Number(n.toFixed(1))} g`;

function usageText(food: ManagedFood) {
  const { nutritionLogs, mealItems } = food._count;
  if (!nutritionLogs && !mealItems) return "Not used yet";
  return [nutritionLogs && `${nutritionLogs} log${nutritionLogs === 1 ? "" : "s"}`, mealItems && `${mealItems} plan item${mealItems === 1 ? "" : "s"}`]
    .filter(Boolean)
    .join(" · ");
}

export function FoodsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ManagedFood | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<ManagedFood | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, isPending, isError, isPlaceholderData } = useQuery({
    queryKey: ["managed-foods", debouncedSearch, page],
    queryFn: () => listManagedFoods({ search: debouncedSearch || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (food: ManagedFood) => deleteFood(food.id),
    onSuccess: (_d, food) => {
      queryClient.invalidateQueries({ queryKey: ["managed-foods"] });
      queryClient.invalidateQueries({ queryKey: ["admin-foods-all"] });
      toast.show(`Removed ${food.name}`);
      setDeleting(null);
    },
    onError: (err) => toast.show(apiErrorMessage(err, "Could not remove food"), "error"),
  });

  const openForm = (food: ManagedFood | null) => {
    setEditing(food);
    setFormOpen(true);
  };

  const rowActions = (food: ManagedFood) => (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label={`Edit ${food.name}`} onClick={() => openForm(food)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0 text-danger hover:bg-danger/10"
        aria-label={`Remove ${food.name}`}
        onClick={() => setDeleting(food)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Catalog"
        title="Foods"
        description="The food database members log meals against and diet plans are built from. Nutrition values are per 100 g."
        actions={
          <Button onClick={() => openForm(null)}>
            <Plus className="h-4 w-4" /> Add food
          </Button>
        }
      />

      <div className="relative mt-6 max-w-sm">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          type="search"
          aria-label="Search foods"
          placeholder="Search foods..."
          className="pl-11"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isError && (
        <p role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Could not load foods. Check that the backend is running, then refresh.
        </p>
      )}

      {isPending && (
        <div className="mt-6 flex flex-col gap-2" aria-label="Loading foods">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="mt-6">
          {debouncedSearch ? (
            <EmptyState title={`No foods match “${debouncedSearch}”`} description="Try a different spelling, or add it as a new food." />
          ) : (
            <EmptyState
              title="No foods yet"
              description="Add foods so members can log meals and you can build diet plans."
              action={
                <Button onClick={() => openForm(null)}>
                  <Plus className="h-4 w-4" /> Add the first food
                </Button>
              }
            />
          )}
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className={cn("mt-6 transition-opacity", isPlaceholderData && "opacity-60")}>
          {/* Desktop table */}
          <div className="glass-card hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-2 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Food</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Calories</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Protein</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Carbs</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Fat</th>
                  <th scope="col" className="px-4 py-3 font-medium">Used in</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((food) => (
                  <tr key={food.id} className="hover:bg-foreground/[0.02]">
                    <td className="px-4 py-3 font-medium">{food.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{Math.round(food.caloriesPer100g)} kcal</td>
                    <td className="px-4 py-3 text-right tabular-nums">{grams(food.proteinPer100g)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{grams(food.carbsPer100g)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{grams(food.fatPer100g)}</td>
                    <td className="px-4 py-3 text-xs text-muted">{usageText(food)}</td>
                    <td className="px-4 py-2">{rowActions(food)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-2 md:hidden">
            {data.items.map((food) => (
              <li key={food.id} className="glass-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{food.name}</p>
                    <p className="mt-0.5 text-xs text-muted">{usageText(food)}</p>
                  </div>
                  {rowActions(food)}
                </div>
                <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                  {[
                    ["kcal", Math.round(food.caloriesPer100g)],
                    ["Protein", grams(food.proteinPer100g)],
                    ["Carbs", grams(food.carbsPer100g)],
                    ["Fat", grams(food.fatPer100g)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex flex-col-reverse rounded-lg bg-surface-2 py-2">
                      <dt className="text-muted">{label}</dt>
                      <dd className="font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>

          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} total={data.pagination.total} onPageChange={setPage} />
        </div>
      )}

      <FoodFormDialog open={formOpen} food={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Remove ${deleting?.name ?? "food"}?`}
        destructive
        confirmLabel="Remove food"
        pending={deleteMutation.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        message={
          deleting && (deleting._count.nutritionLogs || deleting._count.mealItems) ? (
            <>
              It's used in <strong className="text-foreground">{usageText(deleting)}</strong>. Those keep their data — the food just
              stops appearing in search. Adding a food with the same name later restores it.
            </>
          ) : (
            "It will no longer appear in search for meal logging or diet plans. Adding a food with the same name later restores it."
          )
        }
      />
    </div>
  );
}
