import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Disc3, ArrowDown, ArrowUp, Calculator, Droplets, Dumbbell, ExternalLink, Eye, EyeOff, Flame, Gauge, GripVertical, HeartPulse, Loader2, Pencil, PieChart, Ruler, Scale, Search, Timer, type LucideIcon } from "lucide-react";
import { listAdminTools, reorderTools, updateTool, type AdminTool, type ToolCategory } from "@/lib/api";
import { apiErrorMessage, useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const USER_APP_URL = import.meta.env.VITE_USER_APP_URL ?? "http://localhost:3000";
const KEY = ["admin-tools"];

const ICONS: Record<string, LucideIcon> = {
  "1rm": Dumbbell,
  tdee: Flame,
  macros: PieChart,
  "body-fat": Ruler,
  bmr: Gauge,
  bmi: Scale,
  water: Droplets,
  "heart-rate": HeartPulse,
  "plate-loader": Disc3,
  timer: Timer,
};

const CATEGORY_LABEL: Record<ToolCategory, string> = {
  STRENGTH: "Strength",
  NUTRITION: "Nutrition",
  BODY_COMP: "Body comp",
  CARDIO: "Cardio",
  TRAINING: "Training",
};

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-60",
        checked ? "border-gold bg-gold" : "border-border bg-surface-2"
      )}
    >
      <span className={cn("absolute top-0.5 h-4.5 w-4.5 rounded-full shadow transition-all", checked ? "left-[22px] bg-accent-foreground" : "left-0.5 bg-muted")} />
    </button>
  );
}

function EditDialog({ tool, onClose }: { tool: AdminTool | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!tool) return;
    setTitle(tool.title);
    setDescription(tool.description);
    setErrors({});
    setServerError(null);
  }, [tool]);

  const save = useMutation({
    mutationFn: () => updateTool(tool!.id, { title: title.trim(), description: description.trim() }),
    onSuccess: (saved) => {
      queryClient.setQueryData<AdminTool[]>(KEY, (list) => list?.map((t) => (t.id === saved.id ? saved : t)));
      toast.show(`Updated ${saved.title}`);
      onClose();
    },
    onError: (err) => setServerError(apiErrorMessage(err, "Could not save")),
  });

  const submit = () => {
    const found = {
      title: !title.trim() ? "Title is required" : title.trim().length > 60 ? "Keep it under 60 characters" : undefined,
      description: !description.trim() ? "Description is required" : description.trim().length > 160 ? "Keep it under 160 characters" : undefined,
    };
    setErrors(found);
    if (!found.title && !found.description) save.mutate();
  };

  return (
    <Dialog
      open={Boolean(tool)}
      onClose={save.isPending ? () => {} : onClose}
      title={`Edit ${tool?.title ?? "tool"}`}
      description="This is the text members see on the tool's card and page."
      footer={
        <>
          <Button variant="glass" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="tool-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </Button>
        </>
      }
    >
      <form
        id="tool-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div>
          <label htmlFor="tool-title" className="mb-1.5 block text-sm font-medium">
            Title
          </label>
          <Input id="tool-title" data-autofocus value={title} maxLength={60} aria-invalid={errors.title ? true : undefined} aria-describedby="tool-title-error" onChange={(e) => setTitle(e.target.value)} />
          <FieldError id="tool-title-error" message={errors.title} />
        </div>
        <div>
          <label htmlFor="tool-description" className="mb-1.5 flex justify-between text-sm font-medium">
            Short description <span className="text-xs font-normal text-muted">{description.trim().length}/160</span>
          </label>
          <textarea
            id="tool-description"
            rows={3}
            maxLength={160}
            value={description}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby="tool-description-error"
            onChange={(e) => setDescription(e.target.value)}
            className="glass-input w-full resize-none px-4 py-3 text-sm outline-none focus:border-gold/60 focus:ring-2 focus:ring-gold/25"
          />
          <FieldError id="tool-description-error" message={errors.description} />
        </div>
        <FormAlert message={serverError} />
      </form>
    </Dialog>
  );
}

export function ToolsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminTool | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const { data: tools, isPending, isError } = useQuery({ queryKey: KEY, queryFn: listAdminTools });

  const toggle = useMutation({
    mutationFn: (t: AdminTool) => updateTool(t.id, { isEnabled: !t.isEnabled }),
    // Flip immediately; roll back if the server says no.
    onMutate: async (t) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const previous = queryClient.getQueryData<AdminTool[]>(KEY);
      queryClient.setQueryData<AdminTool[]>(KEY, (list) => list?.map((x) => (x.id === t.id ? { ...x, isEnabled: !t.isEnabled } : x)));
      return { previous };
    },
    onSuccess: (saved) => toast.show(`${saved.title} is now ${saved.isEnabled ? "live for members" : "hidden"}`),
    onError: (err, _t, ctx) => {
      queryClient.setQueryData(KEY, ctx?.previous);
      toast.show(apiErrorMessage(err, "Could not change visibility"), "error");
    },
  });

  const reorder = useMutation({
    mutationFn: (list: AdminTool[]) => reorderTools(list.map((t) => t.id)),
    onMutate: async (list) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const previous = queryClient.getQueryData<AdminTool[]>(KEY);
      queryClient.setQueryData(KEY, list);
      return { previous };
    },
    onSuccess: (saved) => queryClient.setQueryData(KEY, saved),
    onError: (err, _l, ctx) => {
      queryClient.setQueryData(KEY, ctx?.previous);
      toast.show(apiErrorMessage(err, "Could not save the new order"), "error");
    },
  });

  const move = (from: number, to: number) => {
    if (!tools || from === to || to < 0 || to >= tools.length) return;
    const next = [...tools];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    reorder.mutate(next);
  };

  const term = search.trim().toLowerCase();
  // Reordering a filtered list would be confusing, so drag/arrows need the full list.
  const filtered = term ? tools?.filter((t) => t.title.toLowerCase().includes(term) || CATEGORY_LABEL[t.category].toLowerCase().includes(term)) : tools;
  const live = tools?.filter((t) => t.isEnabled).length ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Tools manager"
        description="Choose which calculators members see on the Fitness Tools page and in what order. Drag the handle or use the arrows to reorder."
        actions={
          <a href={`${USER_APP_URL}/tools`} target="_blank" rel="noopener noreferrer">
            <Button variant="glass">
              <ExternalLink className="h-4 w-4" /> View member page
            </Button>
          </a>
        }
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input type="search" aria-label="Search tools" placeholder="Search tools..." className="h-10 pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {tools && (
          <p className="text-sm text-muted">
            <span className="font-semibold text-gold">{live}</span> of {tools.length} live for members
          </p>
        )}
      </div>

      {isPending && <Skeleton className="mt-4 h-96 rounded-2xl" />}
      {isError && (
        <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Could not load the tools. Check that the backend is running, then refresh.
        </p>
      )}

      {filtered && (
        <div className="glass-card mt-4 overflow-hidden">
          <div className="hidden grid-cols-[2.5rem_1fr_8rem_9rem_7rem] items-center gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted md:grid">
            <span />
            <span>Calculator</span>
            <span>Category</span>
            <span>Visibility</span>
            <span className="text-right">Actions</span>
          </div>
          {filtered.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">No tools match “{search}”.</p>}
          <ul>
            {filtered.map((tool) => {
              const i = tools!.indexOf(tool);
              const Icon = ICONS[tool.slug] ?? Calculator;
              const canReorder = !term && !reorder.isPending;
              return (
                <li
                  key={tool.id}
                  draggable={canReorder}
                  onDragStart={(e) => {
                    setDragFrom(i);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    if (dragFrom === null) return;
                    e.preventDefault();
                    setDragOver(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragFrom !== null) move(dragFrom, i);
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                  onDragEnd={() => {
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                  className={cn(
                    "grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[2.5rem_1fr_8rem_9rem_7rem]",
                    !tool.isEnabled && "bg-background/40",
                    dragOver === i && dragFrom !== i && "bg-gold/5 ring-1 ring-inset ring-gold/50",
                    dragFrom === i && "opacity-40"
                  )}
                >
                  <span className={cn("flex items-center justify-center text-muted", canReorder ? "cursor-grab active:cursor-grabbing" : "opacity-30")} title="Drag to reorder" aria-hidden>
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", tool.isEnabled ? "border-gold/25 bg-gold/10" : "border-border bg-surface-2")}>
                      <Icon className={cn("h-5 w-5", tool.isEnabled ? "text-gold" : "text-muted")} />
                    </span>
                    <div className="min-w-0">
                      <p className={cn("truncate font-medium", !tool.isEnabled && "text-muted")}>{tool.title}</p>
                      <p className="truncate text-xs text-muted">
                        /tools/{tool.slug}
                        <span className="md:hidden"> · {CATEGORY_LABEL[tool.category]}</span>
                      </p>
                    </div>
                  </div>
                  <span className="hidden md:block">
                    <span className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-0.5 text-xs text-gold-light">{CATEGORY_LABEL[tool.category]}</span>
                  </span>
                  <div className="col-start-2 row-start-2 flex items-center gap-2.5 md:col-start-auto md:row-start-auto">
                    <Toggle checked={tool.isEnabled} onChange={() => toggle.mutate(tool)} label={`Show ${tool.title} to members`} />
                    <span className={cn("flex items-center gap-1 text-xs font-medium", tool.isEnabled ? "text-success" : "text-muted")}>
                      {tool.isEnabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {tool.isEnabled ? "Live" : "Hidden"}
                    </span>
                  </div>
                  <div className="row-start-1 flex justify-end gap-0.5 md:row-start-auto">
                    <button type="button" disabled={!canReorder || i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${tool.title} up`} className="rounded-lg p-1.5 text-muted hover:text-foreground disabled:opacity-30">
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={!canReorder || i === tools!.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move ${tool.title} down`} className="rounded-lg p-1.5 text-muted hover:text-foreground disabled:opacity-30">
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setEditing(tool)} aria-label={`Edit ${tool.title}`} className="rounded-lg p-1.5 text-muted hover:text-gold">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {term && <p className="mt-2 text-xs text-muted">Clear the search to reorder.</p>}

      <EditDialog tool={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
