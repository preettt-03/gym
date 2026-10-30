import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BadgeCheck, ChevronLeft, ChevronRight, Copy, Download, Eye, EyeOff, History, Loader2, Lock, Monitor, Plus, RefreshCw, Search, ShieldCheck, Trash2, Trophy } from "lucide-react";
import {
  addLeaderboardAdjustment,
  approveLeaderboardMember,
  closeLeaderboardCycles,
  deleteLeaderboardAdjustment,
  downloadLeaderboard,
  getAdminLeaderboard,
  getLeaderboardSettings,
  listLeaderboardAdjustments,
  listLeaderboardSnapshots,
  recalculateLeaderboard,
  setDisplayLink,
  setLeaderboardVisibility,
  updateLeaderboardSettings,
  type AdminLeaderboardEntry,
  type CyclePeriod,
  type RewardsConfig,
  type FraudFlag,
  type LeaderboardPeriod,
  type LeaderboardSettings,
} from "@/lib/leaderboard-api";
import { apiErrorMessage, useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/user-badges";
import { cn } from "@/lib/utils";

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "all-time", label: "All-time" },
];

const FLAG_LABEL: Record<FraudFlag, string> = {
  TOO_MANY_WORKOUTS: "Too many workouts in a day",
  TOO_MANY_CALORIES: "Too many calories in a day",
  LONG_VISIT: "Unusually long gym visit",
};

const TZ = "Asia/Kolkata";
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: TZ });
const monthYear = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: TZ });
const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ });
const num = new Intl.NumberFormat("en-IN");

function rangeLabel(period: LeaderboardPeriod, offset: number, range: { start: string; end: string }) {
  const start = new Date(range.start);
  const last = new Date(new Date(range.end).getTime() - 1);
  if (period === "all-time") return "All time";
  if (period === "daily") return offset === 0 ? "Today" : offset === 1 ? "Yesterday" : shortDate.format(start);
  if (period === "weekly") return `${offset === 0 ? "This week" : offset === 1 ? "Last week" : "Week"} · ${shortDate.format(start)} – ${shortDate.format(last)}`;
  return `${offset === 0 ? "This month" : offset === 1 ? "Last month" : "Month"} · ${monthYear.format(start)}`;
}

function duration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

type Filter = "all" | "flagged" | "hidden";

const USER_APP_URL = (import.meta.env.VITE_USER_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const CYCLES: { key: CyclePeriod; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

export function LeaderboardPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [adjusting, setAdjusting] = useState<AdminLeaderboardEntry | null>(null);
  const [historyFor, setHistoryFor] = useState<AdminLeaderboardEntry | null>(null);
  const [hiding, setHiding] = useState<AdminLeaderboardEntry | null>(null);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  const board = useQuery({
    queryKey: ["admin-leaderboard", period, offset],
    queryFn: () => getAdminLeaderboard(period, offset),
    placeholderData: keepPreviousData,
  });
  // Loaded on its own so the rules stay editable even if the board fails to load.
  const settings = useQuery({ queryKey: ["admin-leaderboard-settings"], queryFn: getLeaderboardSettings });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-leaderboard"] });
    queryClient.invalidateQueries({ queryKey: ["admin-leaderboard-settings"] });
  };
  // Boards are cached for a few minutes; this drops the cache, then reloads.
  const recalc = useMutation({
    mutationFn: recalculateLeaderboard,
    onSuccess: () => {
      refresh();
      toast.show("Rankings recalculated");
    },
    onError: (err) => toast.show(apiErrorMessage(err, "Could not recalculate"), "error"),
  });

  const entries = board.data?.entries;
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (entries ?? []).filter(
      (e) =>
        (filter === "all" || (filter === "flagged" ? e.flags.length > 0 || e.frozen : e.hidden)) &&
        (!term || [e.name, e.email, e.phone].some((v) => v?.toLowerCase().includes(term)))
    );
  }, [entries, search, filter]);

  const stats = useMemo(() => {
    const list = entries ?? [];
    return {
      ranked: list.filter((e) => e.rank !== null).length,
      flagged: list.filter((e) => e.flags.length > 0).length,
      frozen: list.filter((e) => e.frozen && !e.hidden).length,
      hidden: list.filter((e) => e.hidden).length,
      workouts: list.reduce((n, e) => n + e.workouts, 0),
    };
  }, [entries]);

  const visibility = useMutation({
    mutationFn: ({ entry, hidden, reason }: { entry: AdminLeaderboardEntry; hidden: boolean; reason?: string }) =>
      setLeaderboardVisibility(entry.userId, hidden, reason),
    onSuccess: (_d, v) => {
      toast.show(v.hidden ? `${v.entry.name} is hidden from the board` : `${v.entry.name} is back on the board`);
      setHiding(null);
      refresh();
    },
    onError: (err) => toast.show(apiErrorMessage(err, "Could not update visibility"), "error"),
  });

  const approve = useMutation({
    mutationFn: (entry: AdminLeaderboardEntry) => approveLeaderboardMember(entry.userId),
    onSuccess: (_d, entry) => {
      toast.show(`${entry.name} approved — back on the board`);
      refresh();
    },
    onError: (err) => toast.show(apiErrorMessage(err, "Could not approve"), "error"),
  });

  const exportBoard = async (format: "csv" | "xlsx") => {
    setExporting(format);
    try {
      await downloadLeaderboard(period, offset, format);
    } catch (err) {
      toast.show(apiErrorMessage(err, "Export failed"), "error");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Gamification"
        title="Leaderboard"
        description="Ranks members on workouts, gym visits, time in the gym, calories and streaks. Tune the scoring, review suspicious logs and correct points."
        actions={
          <>
            <Button variant="glass" size="sm" onClick={() => recalc.mutate()} disabled={recalc.isPending || board.isFetching}>
              <RefreshCw className={cn("h-4 w-4", (recalc.isPending || board.isFetching) && "animate-spin")} /> Recalculate
            </Button>
            <Button variant="glass" size="sm" onClick={() => exportBoard("csv")} disabled={Boolean(exporting)}>
              {exporting === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} CSV
            </Button>
            <Button variant="glass" size="sm" onClick={() => exportBoard("xlsx")} disabled={Boolean(exporting)}>
              {exporting === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Excel
            </Button>
          </>
        }
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="order-2 flex flex-col gap-6 xl:order-1">
          {settings.data ? (
            <>
              <ScoringPanel settings={settings.data} onSaved={refresh} />
              <RewardsPanel rewards={settings.data.rewards} onSaved={refresh} />
              <DisplayPanel displayKey={settings.data.displayKey} onSaved={refresh} />
            </>
          ) : settings.isError ? (
            <Card className="text-sm text-danger">{apiErrorMessage(settings.error, "Could not load scoring rules.")}</Card>
          ) : (
            <Skeleton className="h-[36rem] rounded-2xl" />
          )}
        </div>

        <div className="order-1 min-w-0 xl:order-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Period" className="inline-flex rounded-xl border border-border bg-surface p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  role="tab"
                  aria-selected={period === p.key}
                  onClick={() => (setPeriod(p.key), setOffset(0))}
                  className={cn(
                    "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                    period === p.key ? "bg-gold text-accent-foreground" : "text-muted hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {period !== "all-time" && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Previous period" onClick={() => setOffset((o) => o + 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-40 text-center text-sm text-muted">{board.data ? rangeLabel(period, offset, board.data.range) : "…"}</span>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Next period" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Ranked members" value={stats.ranked} />
            <Stat label="Workouts logged" value={stats.workouts} />
            <Stat label={stats.frozen ? `Flagged · ${stats.frozen} frozen` : "Flagged"} value={stats.flagged} tone={stats.flagged ? "warn" : undefined} />
            <Stat label="Hidden" value={stats.hidden} />
          </div>

          {settings.data && !settings.data.isEnabled && (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2.5 text-sm text-gold">
              <EyeOff className="h-4 w-4" /> The member leaderboard is switched off — members see a “paused” message.
            </p>
          )}

          <Card className="mt-4 p-0">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input className="h-10 pl-10" placeholder="Search name, email or phone..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search members" />
              </div>
              <div className="flex gap-1.5">
                {(["all", "flagged", "hidden"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm capitalize transition-colors",
                      filter === f ? "border-gold bg-gold font-semibold text-accent-foreground" : "border-border text-muted hover:text-foreground"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {board.isPending && (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            )}
            {board.isError && <p className="p-6 text-sm text-danger">{apiErrorMessage(board.error, "Could not load the leaderboard.")}</p>}
            {board.data && shown.length === 0 && (
              <p className="px-6 py-14 text-center text-sm text-muted">
                {entries?.length ? "No members match this filter." : "No activity in this period yet — rankings appear once members log workouts or check in."}
              </p>
            )}

            {shown.length > 0 && (
              <div className={cn("overflow-x-auto transition-opacity", board.isPlaceholderData && "opacity-60")}>
                <table className="w-full min-w-[54rem] whitespace-nowrap text-left text-sm">
                  <thead className="border-b border-border bg-surface-2 text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-3 font-medium">Rank</th>
                      <th scope="col" className="px-3 py-3 font-medium">Member</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Workouts</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Visits</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Calories</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Gym time</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Points</th>
                      <th scope="col" className="px-3 py-3 font-medium">Status</th>
                      <th scope="col" className="sticky right-0 bg-surface-2 px-3 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((e) => (
                      <tr key={e.userId} className={cn("border-b border-border last:border-0", e.hidden && "opacity-60")}>
                        <td className="px-3 py-3 font-semibold text-muted">{e.rank ? `#${e.rank}` : "—"}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={e.name} email={e.email} photoUrl={e.photoUrl} />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{e.name}</p>
                              <p className="truncate text-xs text-muted">{e.email ?? e.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{e.workouts}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{e.visits}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{num.format(e.caloriesBurned)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{duration(e.gymMinutes)}</td>
                        <td className="px-3 py-3 text-right">
                          <p className="font-semibold tabular-nums text-gold">{num.format(e.points)}</p>
                          {e.adjustmentPoints !== 0 && (
                            <p className={cn("text-xs tabular-nums", e.adjustmentPoints > 0 ? "text-success" : "text-danger")}>
                              {e.adjustmentPoints > 0 ? "+" : ""}
                              {num.format(e.adjustmentPoints)} manual
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <StatusPill entry={e} />
                        </td>
                        {/* Pinned so the actions stay reachable when the table scrolls sideways. */}
                        <td className="sticky right-0 bg-surface px-3 py-3 shadow-[-12px_0_12px_-12px_rgba(0,0,0,0.6)]">
                          <div className="flex justify-end gap-1">
                            <IconAction label={`Adjust points for ${e.name}`} onClick={() => setAdjusting(e)}>
                              <Plus className="h-4 w-4" />
                            </IconAction>
                            <IconAction label={`Points history for ${e.name}`} onClick={() => setHistoryFor(e)}>
                              <History className="h-4 w-4" />
                            </IconAction>
                            {(e.frozen || e.flags.length > 0) && !e.hidden && (
                              <IconAction label={`Approve ${e.name}'s logs`} onClick={() => approve.mutate(e)}>
                                <BadgeCheck className="h-4 w-4" />
                              </IconAction>
                            )}
                            {e.hidden ? (
                              <IconAction label={`Show ${e.name} on the board`} onClick={() => visibility.mutate({ entry: e, hidden: false })}>
                                <Eye className="h-4 w-4" />
                              </IconAction>
                            ) : (
                              <IconAction label={`Hide ${e.name} from the board`} danger onClick={() => setHiding(e)}>
                                <EyeOff className="h-4 w-4" />
                              </IconAction>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <PastWinners />
        </div>
      </div>

      <AdjustDialog entry={adjusting} onClose={() => setAdjusting(null)} onSaved={refresh} />
      <HistoryDialog entry={historyFor} onClose={() => setHistoryFor(null)} onChanged={refresh} />
      <HideDialog entry={hiding} pending={visibility.isPending} onClose={() => setHiding(null)} onConfirm={(reason) => hiding && visibility.mutate({ entry: hiding, hidden: true, reason })} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="glass-card px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-bold", tone === "warn" ? "text-gold" : "text-foreground")}>{num.format(value)}</p>
    </div>
  );
}

function StatusPill({ entry }: { entry: AdminLeaderboardEntry }) {
  if (entry.hidden) {
    return (
      <span title={entry.hiddenReason ?? undefined} className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2.5 py-1 text-xs text-muted">
        <EyeOff className="h-3 w-3" /> Hidden
      </span>
    );
  }
  if (entry.frozen) {
    return (
      <span title={entry.flags.map((f) => FLAG_LABEL[f]).join("\n")} className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2.5 py-1 text-xs font-medium text-danger">
        <Lock className="h-3 w-3" /> Frozen
      </span>
    );
  }
  if (entry.flags.length) {
    return (
      <span title={entry.flags.map((f) => FLAG_LABEL[f]).join("\n")} className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium text-gold">
        <AlertTriangle className="h-3 w-3" /> Flagged
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs text-success">
      <ShieldCheck className="h-3 w-3" /> Clear
    </span>
  );
}

function IconAction({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors",
        danger ? "hover:border-danger/50 hover:text-danger" : "hover:border-gold/50 hover:text-gold"
      )}
    >
      {children}
    </button>
  );
}

// --- Scoring rules ---

type EditableSettings = Omit<LeaderboardSettings, "updatedAt" | "rewards" | "displayKey">;

function scoringFields(s: LeaderboardSettings): EditableSettings {
  const { updatedAt: _u, rewards: _r, displayKey: _d, ...rest } = s;
  return rest;
}

const WEIGHT_FIELDS: { key: keyof EditableSettings; label: string; max: number; format: (n: number) => string; min?: number }[] = [
  { key: "workoutPoints", label: "Completed workout", max: 200, format: (n) => `+${n} pts` },
  { key: "visitPoints", label: "Gym visit (check-in)", max: 200, format: (n) => `+${n} pts` },
  { key: "caloriesPerPoint", label: "Calories burned", min: 1, max: 100, format: (n) => `1 pt / ${n} kcal` },
  { key: "gymMinutePoints", label: "Minute in the gym", max: 10, format: (n) => `+${n} / min` },
  { key: "workoutMinutePoints", label: "Minute of logged exercise", max: 10, format: (n) => `+${n} / min` },
  { key: "streakPoints", label: "Active streak day", max: 200, format: (n) => `+${n} / day` },
];

const FRAUD_FIELDS: { key: keyof EditableSettings; label: string; min: number; max: number; unit: string }[] = [
  { key: "maxWorkoutsPerDay", label: "Max workouts in a day", min: 1, max: 50, unit: "" },
  { key: "maxCaloriesPerDay", label: "Max calories in a day", min: 100, max: 50000, unit: "kcal" },
  { key: "maxGymMinutesPerVisit", label: "Max length of one visit", min: 30, max: 1440, unit: "min" },
];

function ScoringPanel({ settings, onSaved }: { settings: LeaderboardSettings; onSaved: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState<EditableSettings>(() => scoringFields(settings));
  // Pick up server values after a save or when another admin changed them.
  useEffect(() => setDraft(scoringFields(settings)), [settings]);
  const dirty = (Object.keys(draft) as (keyof EditableSettings)[]).some((k) => draft[k] !== settings[k]);
  const set = <K extends keyof EditableSettings>(key: K, value: EditableSettings[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = useMutation({
    mutationFn: () => updateLeaderboardSettings(draft),
    onSuccess: () => {
      toast.show("Scoring rules saved — rankings recalculated");
      onSaved();
    },
    onError: (err) => toast.show(apiErrorMessage(err, "Could not save scoring rules"), "error"),
  });

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <CardTitle>Scoring rules</CardTitle>
        <CardDescription className="mt-1">Points per activity. Changes apply to every period, including past ones.</CardDescription>
      </div>

      <Toggle label="Show leaderboard to members" checked={draft.isEnabled} onChange={(v) => set("isEnabled", v)} />

      <div className="flex flex-col gap-4">
        {WEIGHT_FIELDS.map((f) => {
          const value = draft[f.key] as number;
          return (
            <label key={f.key} className="block">
              <span className="flex items-center justify-between text-sm">
                <span>{f.label}</span>
                <span className="font-semibold text-gold">{f.format(value)}</span>
              </span>
              <input
                type="range"
                min={f.min ?? 0}
                max={f.max}
                value={value}
                onChange={(e) => set(f.key, Number(e.target.value) as never)}
                className="mt-2 w-full accent-[var(--gold)]"
              />
            </label>
          );
        })}
      </div>

      <div className="border-t border-border pt-5">
        <Toggle label="Automatic fraud detection" hint="Flags implausible logs for review" checked={draft.fraudDetection} onChange={(v) => set("fraudDetection", v)} />
        {draft.fraudDetection && (
          <div className="mt-4 flex flex-col gap-3">
            <Toggle label="Auto-freeze flagged members" hint="Keeps them off the board until you approve" checked={draft.autoFreeze} onChange={(v) => set("autoFreeze", v)} />
            {FRAUD_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted">{f.label}</span>
                <span className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={f.min}
                    max={f.max}
                    value={draft[f.key] as number}
                    onChange={(e) => set(f.key, Number(e.target.value) as never)}
                    className="h-9 w-24 text-right"
                  />
                  {f.unit && <span className="w-8 text-xs text-muted">{f.unit}</span>}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-5">
        <Toggle label="Overtake alerts" hint="“Rahul just took #4 from you” — max one a day" checked={draft.overtakeAlerts} onChange={(v) => set("overtakeAlerts", v)} />
        <Toggle label="Monday wrap-up" hint="Last week's rank by notification and email" checked={draft.weeklyWrapUp} onChange={(v) => set("weeklyWrapUp", v)} />
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setDraft(scoringFields(settings))}>
            Reset
          </Button>
        )}
      </div>
    </Card>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full bg-surface-2 ring-1 ring-border transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-muted after:transition-transform peer-checked:bg-gold peer-checked:after:translate-x-5 peer-checked:after:bg-accent-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-gold/60"
      />
    </label>
  );
}

// --- Rewards ---

function RewardsPanel({ rewards, onSaved }: { rewards: RewardsConfig; onSaved: () => void }) {
  const toast = useToast();
  const [cycle, setCycle] = useState<CyclePeriod>("weekly");
  const [draft, setDraft] = useState<RewardsConfig>(rewards);
  useEffect(() => setDraft(rewards), [rewards]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(rewards);
  const tier = draft[cycle];
  const setTier = (patch: Partial<typeof tier>) => setDraft((d) => ({ ...d, [cycle]: { ...d[cycle], ...patch } }));
  const setPrize = (kind: "coins" | "xp", i: number, value: number) => {
    const next = [...tier[kind]] as [number, number, number];
    next[i] = Math.max(0, Math.round(value) || 0);
    setTier({ [kind]: next });
  };

  const save = useMutation({
    mutationFn: () => updateLeaderboardSettings({ rewards: draft }),
    onSuccess: () => {
      toast.show("Rewards saved");
      onSaved();
    },
    onError: (err) => toast.show(apiErrorMessage(err, "Could not save rewards"), "error"),
  });

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle>Winner rewards</CardTitle>
        <CardDescription className="mt-1">Paid automatically when each cycle ends, with Gold / Silver / Bronze badges and a celebration pop-up.</CardDescription>
      </div>
      <div role="tablist" aria-label="Reward cycle" className="grid grid-cols-3 rounded-xl border border-border bg-surface p-1">
        {CYCLES.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={cycle === c.key}
            onClick={() => setCycle(c.key)}
            className={cn("rounded-lg py-1.5 text-sm font-medium", cycle === c.key ? "bg-gold text-accent-foreground" : "text-muted hover:text-foreground")}
          >
            {c.label}
          </button>
        ))}
      </div>
      <Toggle label={`Reward ${cycle} winners`} checked={tier.enabled} onChange={(v) => setTier({ enabled: v })} />
      <div className={cn("grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-2 text-sm", !tier.enabled && "pointer-events-none opacity-50")}>
        <span />
        <span className="text-xs uppercase tracking-wider text-muted">Coins</span>
        <span className="text-xs uppercase tracking-wider text-muted">XP</span>
        {["🥇 1st", "🥈 2nd", "🥉 3rd"].map((label, i) => (
          <div key={label} className="contents">
            <span className="whitespace-nowrap">{label}</span>
            <Input type="number" min={0} aria-label={`${label} coins`} value={tier.coins[i]} onChange={(e) => setPrize("coins", i, Number(e.target.value))} className="h-9" />
            <Input type="number" min={0} aria-label={`${label} XP`} value={tier.xp[i]} onChange={(e) => setPrize("xp", i, Number(e.target.value))} className="h-9" />
          </div>
        ))}
      </div>
      <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save rewards
      </Button>
    </Card>
  );
}

// --- Reception TV ---

function DisplayPanel({ displayKey, onSaved }: { displayKey: string | null; onSaved: () => void }) {
  const toast = useToast();
  const url = displayKey ? `${USER_APP_URL}/display/leaderboard?key=${displayKey}` : null;
  const toggle = useMutation({
    mutationFn: setDisplayLink,
    onSuccess: (_s, enabled) => {
      toast.show(enabled ? "New TV link created — old links stop working" : "TV link switched off");
      onSaved();
    },
    onError: (err) => toast.show(apiErrorMessage(err, "Could not update the TV link"), "error"),
  });
  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.show("TV link copied");
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <Monitor className="h-5 w-5" />
        </span>
        <div>
          <CardTitle>Reception TV</CardTitle>
          <CardDescription className="mt-1">Full-screen board for the gym floor. Switches between today and this week every 30 s. Shows first names only.</CardDescription>
        </div>
      </div>
      {url ? (
        <>
          <div className="flex items-center gap-2">
            <Input readOnly value={url} aria-label="TV link" className="h-9 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button variant="glass" size="sm" className="h-9 w-9 shrink-0 p-0" aria-label="Copy TV link" onClick={copy}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <a href={url} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "glass", size: "sm" }), "flex-1")}>
              Open
            </a>
            <Button variant="glass" size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate(true)}>
              New link
            </Button>
            <Button variant="ghost" size="sm" className="text-danger" disabled={toggle.isPending} onClick={() => toggle.mutate(false)}>
              Turn off
            </Button>
          </div>
        </>
      ) : (
        <Button variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate(true)}>
          {toggle.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create TV link
        </Button>
      )}
    </Card>
  );
}

// --- Past winners ---

const snapshotDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });

function PastWinners() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [cycle, setCycle] = useState<CyclePeriod>("weekly");
  const snapshots = useQuery({ queryKey: ["leaderboard-snapshots", cycle], queryFn: () => listLeaderboardSnapshots(cycle) });
  const close = useMutation({
    mutationFn: closeLeaderboardCycles,
    onSuccess: (closed) => {
      toast.show(closed.length ? `Closed ${closed.map((c) => c.period).join(", ")} — winners paid` : "Every finished cycle is already paid out");
      queryClient.invalidateQueries({ queryKey: ["leaderboard-snapshots"] });
    },
    onError: (err) => toast.show(apiErrorMessage(err, "Could not close cycles"), "error"),
  });

  const label = (s: { period: CyclePeriod; periodStart: string; periodEnd: string }) => {
    const start = new Date(s.periodStart);
    if (s.period === "daily") return snapshotDate.format(start);
    if (s.period === "monthly") return monthYear.format(start);
    return `${shortDate.format(start)} – ${shortDate.format(new Date(new Date(s.periodEnd).getTime() - 1))}`;
  };

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-gold" /> Past winners
          </CardTitle>
          <CardDescription className="mt-1">Frozen when each cycle ends; rewards are paid at the same moment.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Winners cycle" className="inline-flex rounded-xl border border-border bg-surface p-1">
            {CYCLES.map((c) => (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={cycle === c.key}
                onClick={() => setCycle(c.key)}
                className={cn("rounded-lg px-3 py-1 text-sm", cycle === c.key ? "bg-gold font-medium text-accent-foreground" : "text-muted hover:text-foreground")}
              >
                {c.label}
              </button>
            ))}
          </div>
          <Button variant="glass" size="sm" disabled={close.isPending} onClick={() => close.mutate()} title="Runs automatically every few minutes">
            {close.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Pay out now
          </Button>
        </div>
      </div>

      {snapshots.isPending && <Skeleton className="mt-4 h-24 rounded-xl" />}
      {snapshots.data?.length === 0 && <p className="py-8 text-center text-sm text-muted">No finished {cycle} cycles yet.</p>}
      <ul className="mt-4 flex flex-col gap-2">
        {snapshots.data?.map((snap) => (
          <li key={snap.id} className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center">
            <span className="w-40 shrink-0 text-sm font-medium">{label(snap)}</span>
            {snap.awards.length === 0 ? (
              <span className="text-sm text-muted">No winners (no activity or rewards off)</span>
            ) : (
              <span className="flex flex-1 flex-wrap gap-2">
                {snap.awards.map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-3 text-sm">
                    <Avatar name={a.user.name} email={null} photoUrl={a.user.photoUrl} />
                    <span>
                      {["🥇", "🥈", "🥉"][a.rank - 1]} {a.user.name ?? "Member"}
                      <span className="ml-1.5 text-xs text-muted">
                        {num.format(a.points)} pts · +{num.format(a.coins)} coins
                      </span>
                    </span>
                  </span>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// --- Dialogs ---

function AdjustDialog({ entry, onClose, onSaved }: { entry: AdminLeaderboardEntry | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (entry) {
      setPoints("");
      setReason("");
    }
  }, [entry]);

  const value = Number(points);
  const valid = Number.isInteger(value) && value !== 0 && reason.trim().length >= 3;

  const save = useMutation({
    mutationFn: () => addLeaderboardAdjustment({ userId: entry!.userId, points: value, reason: reason.trim() }),
    onSuccess: () => {
      toast.show(`${value > 0 ? "Added" : "Removed"} ${Math.abs(value)} pts for ${entry!.name}`);
      onSaved();
      onClose();
    },
    onError: (err) => toast.show(apiErrorMessage(err, "Could not adjust points"), "error"),
  });

  return (
    <Dialog
      open={Boolean(entry)}
      onClose={onClose}
      title={`Adjust points · ${entry?.name ?? ""}`}
      description="Counts towards today's, this week's and this month's boards. Use a negative number to take points away."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save.mutate();
        }}
      >
        <div className="flex gap-2">
          {[-100, -50, 50, 100].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPoints(String(n))}
              className={cn("flex-1 rounded-lg border border-border py-1.5 text-sm hover:border-gold/50", n < 0 ? "text-danger" : "text-success")}
            >
              {n > 0 ? "+" : ""}
              {n}
            </button>
          ))}
        </div>
        <label className="block text-sm">
          Points
          <Input data-autofocus type="number" className="mt-1.5" placeholder="e.g. 100 or -50" value={points} onChange={(e) => setPoints(e.target.value)} />
        </label>
        <label className="block text-sm">
          Reason
          <Input className="mt-1.5" placeholder="e.g. Won the plank challenge" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function HistoryDialog({ entry, onClose, onChanged }: { entry: AdminLeaderboardEntry | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const history = useQuery({
    queryKey: ["leaderboard-adjustments", entry?.userId],
    queryFn: () => listLeaderboardAdjustments(entry!.userId),
    enabled: Boolean(entry),
  });
  const remove = useMutation({
    mutationFn: deleteLeaderboardAdjustment,
    onSuccess: () => {
      toast.show("Adjustment removed");
      queryClient.invalidateQueries({ queryKey: ["leaderboard-adjustments", entry?.userId] });
      onChanged();
    },
    onError: (err) => toast.show(apiErrorMessage(err, "Could not remove adjustment"), "error"),
  });

  return (
    <Dialog open={Boolean(entry)} onClose={onClose} title={`Points history · ${entry?.name ?? ""}`} size="md">
      {entry && (
        <div className="mb-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {[
            ["Earned", entry.basePoints],
            ["Manual", entry.adjustmentPoints],
            ["Total", entry.points],
            ["Workouts", entry.workouts],
            ["Workout time", entry.workoutMinutes],
            ["Streak days", entry.streakDays],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-surface-2 px-3 py-2">
              <p className="text-xs text-muted">{label}</p>
              <p className="font-semibold">{label === "Workout time" ? duration(value as number) : num.format(value as number)}</p>
            </div>
          ))}
        </div>
      )}
      {entry && entry.flags.length > 0 && (
        <ul className="mb-4 flex flex-col gap-1 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold">
          {entry.flags.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" /> {FLAG_LABEL[f]}
            </li>
          ))}
        </ul>
      )}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Manual adjustments</p>
      {history.isPending && <Skeleton className="h-16 rounded-xl" />}
      {history.data?.length === 0 && <p className="py-6 text-center text-sm text-muted">No manual adjustments yet.</p>}
      <ul className="flex flex-col gap-2">
        {history.data?.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
            <span className={cn("w-16 shrink-0 font-semibold tabular-nums", a.points > 0 ? "text-success" : "text-danger")}>
              {a.points > 0 ? "+" : ""}
              {num.format(a.points)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{a.reason}</span>
              <span className="block text-xs text-muted">
                {dateTime.format(new Date(a.effectiveAt))} · {a.createdBy?.name ?? a.createdBy?.email ?? "Admin"}
              </span>
            </span>
            <button
              type="button"
              aria-label="Remove adjustment"
              disabled={remove.isPending}
              onClick={() => remove.mutate(a.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

function HideDialog({ entry, pending, onClose, onConfirm }: { entry: AdminLeaderboardEntry | null; pending: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (entry) setReason(entry.flags.length ? entry.flags.map((f) => FLAG_LABEL[f]).join(", ") : "");
  }, [entry]);

  return (
    <Dialog
      open={Boolean(entry)}
      onClose={pending ? () => {} : onClose}
      title={`Hide ${entry?.name ?? ""} from the board?`}
      description="They stop appearing on every member leaderboard until you show them again. Their logs are kept."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending} onClick={() => onConfirm(reason.trim())}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Hide member
          </Button>
        </>
      }
    >
      <label className="block text-sm">
        Reason (only admins see this)
        <Input data-autofocus className="mt-1.5" maxLength={200} placeholder="e.g. Duplicate workout logs" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
    </Dialog>
  );
}
