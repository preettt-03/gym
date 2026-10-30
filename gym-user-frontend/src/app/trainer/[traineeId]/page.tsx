"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Dumbbell,
  Loader2,
  Lock,
  Pencil,
  Send,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import {
  addPrivateNote,
  assignDietPlanToTrainee,
  assignWorkoutPlanToTrainee,
  deletePrivateNote,
  getTraineeOverview,
  getTraineeProfile,
  listAssignableDietPlans,
  listAssignableWorkoutPlans,
  listPrivateNotes,
  listTraineeAttendance,
  listTraineeWeightLogs,
  listTraineeWorkoutLogs,
  sendNoteToTrainee,
  updatePrivateNote,
  type PrivateNote,
} from "@/lib/trainer-api";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FormAlert } from "@/components/ui/form-message";
import { useAuthStore } from "@/stores/auth-store";
import { cn, humanize } from "@/lib/utils";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "progress", label: "Progress" },
  { key: "workouts", label: "Workouts" },
  { key: "visits", label: "Visits" },
  { key: "notes", label: "Private notes" },
  { key: "plans", label: "Plans & messages" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

const errorText = (err: unknown, fallback: string) =>
  isAxiosError(err) ? err.response?.data?.error?.message ?? fallback : fallback;

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("glass-card p-6", className)}>
      <h2 className="text-lg font-semibold uppercase">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

function OverviewTab({ traineeId }: { traineeId: string }) {
  const profile = useQuery({ queryKey: ["trainer-trainee-profile", traineeId], queryFn: () => getTraineeProfile(traineeId) });
  const overview = useQuery({ queryKey: ["trainer-trainee-overview", traineeId], queryFn: () => getTraineeOverview(traineeId) });
  const p = profile.data;
  const o = overview.data;

  if (profile.isPending || overview.isPending) return <Skeleton className="h-64 rounded-2xl" />;

  const tiles = o
    ? [
        ["BMI", o.metrics.bmi ? `${o.metrics.bmi}${o.metrics.bmiCategory ? ` · ${humanize(o.metrics.bmiCategory)}` : ""}` : "—"],
        ["Daily calories", o.metrics.calorieNeeds ? `~${Math.round(o.metrics.calorieNeeds)} kcal` : "—"],
        ["Streak", `${o.streak.currentStreak} days (best ${o.streak.longestStreak})`],
        ["Today", o.gymAttendanceStatus.checkedIn ? "Checked in at the gym" : "Not checked in"],
        ["Active plan", o.activePlan?.title ?? "None"],
        ["Missions today", `${o.dailyMissionProgress.completed} / ${o.dailyMissionProgress.total}`],
      ]
    : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <Panel title="At a glance">
        <dl className="grid gap-4 sm:grid-cols-2">
          {tiles.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-surface-2 p-4">
              <dt className="text-xs uppercase tracking-widest text-muted">{label}</dt>
              <dd className="mt-1 font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted">BMI and calorie figures are estimates from the member&apos;s profile, not medical measurements.</p>
      </Panel>

      <div className="flex flex-col gap-4">
        {p && (p.medicalConditions.length > 0 || p.allergies.length > 0 || p.injuries.length > 0) ? (
          <section className="rounded-2xl border border-[#fab219]/40 bg-[#fab219]/5 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold uppercase">
              <AlertTriangle className="h-5 w-5 text-[#fab219]" /> Safety notes
            </h2>
            {p.medicalConditions.length > 0 && (
              <p className="mt-3 text-sm">
                <span className="font-semibold">Medical:</span> {p.medicalConditions.join(", ")}
              </p>
            )}
            {p.injuries.length > 0 && (
              <p className="mt-2 text-sm">
                <span className="font-semibold">Injuries:</span> {p.injuries.join(", ")}
              </p>
            )}
            {p.allergies.length > 0 && (
              <p className="mt-2 text-sm">
                <span className="font-semibold">Allergies:</span> {p.allergies.join(", ")}
              </p>
            )}
          </section>
        ) : (
          <section className="glass-card flex items-center gap-3 p-5 text-sm text-muted">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> No medical conditions or allergies on file.
          </section>
        )}

        {p && (
          <Panel title="Profile">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Goal", humanize(p.fitnessGoal) ?? "—"],
                ["Experience", humanize(p.experienceLevel) ?? "—"],
                ["Age", p.age ? String(p.age) : "—"],
                ["Height", p.heightCm ? `${p.heightCm} cm` : "—"],
                ["Weight", p.weightKg ? `${p.weightKg} kg` : "—"],
                ["Target", p.targetWeightKg ? `${p.targetWeightKg} kg` : "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        )}
      </div>
    </div>
  );
}

function ProgressTab({ traineeId, target }: { traineeId: string; target: number | null }) {
  const { data: logs, isPending } = useQuery({
    queryKey: ["trainer-trainee-weight-logs", traineeId],
    queryFn: () => listTraineeWeightLogs(traineeId),
  });
  if (isPending) return <Skeleton className="h-80 rounded-2xl" />;
  if (!logs?.length) return <Panel title="Weight trend"><Muted>No weigh-ins logged yet.</Muted></Panel>;

  const points = [...logs].reverse().map((l) => ({ date: shortDate.format(new Date(l.loggedAt)), weight: l.weightKg }));
  const first = points[0].weight;
  const last = points.at(-1)!.weight;
  const change = +(last - first).toFixed(1);

  return (
    <Panel title="Weight trend">
      <p className="text-sm text-muted">
        {points.length} weigh-ins · {change === 0 ? "no change" : `${change > 0 ? "+" : ""}${change} kg`} since {points[0].date}
        {target ? ` · target ${target} kg` : ""}
      </p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--border)" />
            <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--border)" />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}
              formatter={(v) => [`${v} kg`, "Weight"]}
            />
            {target && <ReferenceLine y={target} stroke="var(--muted)" strokeDasharray="0" label={{ value: "Target", fill: "var(--muted)", fontSize: 11 }} />}
            <Line type="monotone" dataKey="weight" stroke="var(--gold)" strokeWidth={2} dot={{ r: 3, fill: "var(--gold)" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs text-muted hover:text-gold">View data</summary>
        <ul className="mt-2 divide-y divide-border">
          {logs.map((l) => (
            <li key={l.id} className="flex justify-between py-1.5">
              <span>{date.format(new Date(l.loggedAt))}</span>
              <span className="tabular-nums">{l.weightKg} kg</span>
            </li>
          ))}
        </ul>
      </details>
    </Panel>
  );
}

function WorkoutsTab({ traineeId }: { traineeId: string }) {
  const { data: logs, isPending } = useQuery({
    queryKey: ["trainer-trainee-workout-logs", traineeId],
    queryFn: () => listTraineeWorkoutLogs(traineeId),
  });
  if (isPending) return <Skeleton className="h-48 rounded-2xl" />;
  return (
    <Panel title="Recent workouts">
      {!logs?.length ? (
        <Muted>No workouts logged yet.</Muted>
      ) : (
        <ul className="divide-y divide-border">
          {logs.map((log) => (
            <li key={log.id} className="flex items-center justify-between gap-3 py-3 text-sm first:pt-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{log.plan?.title ?? "Workout"}</p>
                {log.notes && <p className="truncate text-xs text-muted">{log.notes}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p>{date.format(new Date(log.date))}</p>
                <p className={cn("text-xs", log.completedAt ? "text-success" : "text-muted")}>{log.completedAt ? "Completed" : "Started"}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function VisitsTab({ traineeId }: { traineeId: string }) {
  const { data: visits, isPending } = useQuery({
    queryKey: ["trainer-trainee-attendance", traineeId],
    queryFn: () => listTraineeAttendance(traineeId),
  });
  if (isPending) return <Skeleton className="h-48 rounded-2xl" />;
  return (
    <Panel title="Gym visits">
      {!visits?.length ? (
        <Muted>No gym visits recorded yet.</Muted>
      ) : (
        <ul className="divide-y divide-border">
          {visits.map((v) => (
            <li key={v.id} className="flex items-center justify-between py-3 text-sm first:pt-0">
              <span>{dateTime.format(new Date(v.checkInAt))}</span>
              <span className="text-xs text-muted">{v.durationMinutes ? `${v.durationMinutes} min` : v.checkOutAt ? "Checked out" : "In the gym"}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function NoteItem({ note, traineeId, canEdit }: { note: PrivateNote; traineeId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const key = ["trainer-private-notes", traineeId];

  const save = useMutation({
    mutationFn: () => updatePrivateNote(note.id, draft.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      setEditing(false);
    },
  });
  const remove = useMutation({
    mutationFn: () => deletePrivateNote(note.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return (
    <li className="rounded-xl bg-surface-2 p-4">
      {editing ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`note-${note.id}`} className="sr-only">
            Edit note
          </label>
          <textarea
            id={`note-${note.id}`}
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="glass-input w-full resize-y px-3 py-2 text-sm outline-none focus:border-gold/60"
          />
          <FormAlert message={save.isError ? errorText(save.error, "Could not save the note") : null} />
          <div className="flex gap-2">
            <Button size="sm" disabled={!draft.trim() || save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </Button>
            <Button size="sm" variant="glass" onClick={() => (setEditing(false), setDraft(note.body))}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-line text-sm leading-relaxed">{note.body}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          {note.author.name ?? note.author.email} · {dateTime.format(new Date(note.createdAt))}
          {note.updatedAt !== note.createdAt && " · edited"}
        </span>
        {canEdit && !editing && (
          <span className="flex gap-1">
            {confirmDelete ? (
              <>
                <Button size="sm" variant="destructive" className="h-8" disabled={remove.isPending} onClick={() => remove.mutate()}>
                  Delete note
                </Button>
                <Button size="sm" variant="glass" className="h-8" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Edit note" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-danger" aria-label="Delete note" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </span>
        )}
      </div>
    </li>
  );
}

function NotesTab({ traineeId }: { traineeId: string }) {
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);
  const [body, setBody] = useState("");
  const key = ["trainer-private-notes", traineeId];
  const { data: notes, isPending } = useQuery({ queryKey: key, queryFn: () => listPrivateNotes(traineeId) });

  const add = useMutation({
    mutationFn: () => addPrivateNote(traineeId, body.trim()),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: key });
    },
  });

  return (
    <Panel title="Private notes">
      <p className="flex items-center gap-2 text-sm text-muted">
        <Lock className="h-4 w-4 text-gold" /> Only coaches can see these — the member never does.
      </p>
      <form
        className="mt-4 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) add.mutate();
        }}
      >
        <label htmlFor="new-note" className="text-sm font-medium">
          Add a note
        </label>
        <textarea
          id="new-note"
          rows={3}
          maxLength={2000}
          placeholder="e.g. Shoulder mobility limited — skip overhead pressing for 2 weeks."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="glass-input w-full resize-y px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-gold/60 focus:ring-2 focus:ring-gold/25"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">{body.length} / 2000</span>
          <Button type="submit" size="sm" disabled={!body.trim() || add.isPending}>
            {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save note
          </Button>
        </div>
        <FormAlert message={add.isError ? errorText(add.error, "Could not save the note") : null} />
      </form>

      <div className="mt-6">
        {isPending && <Skeleton className="h-20 rounded-xl" />}
        {notes?.length === 0 && <Muted>No notes yet.</Muted>}
        {notes && notes.length > 0 && (
          <ul className="flex flex-col gap-3">
            {notes.map((n) => (
              <NoteItem key={n.id} note={n} traineeId={traineeId} canEdit={n.author.id === myId} />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function PlansTab({ traineeId }: { traineeId: string }) {
  const queryClient = useQueryClient();
  const [workoutPlan, setWorkoutPlan] = useState("");
  const [dietPlan, setDietPlan] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const workoutPlans = useQuery({ queryKey: ["trainer-assignable-workout-plans"], queryFn: listAssignableWorkoutPlans });
  const dietPlans = useQuery({ queryKey: ["trainer-assignable-diet-plans"], queryFn: listAssignableDietPlans });

  const assignWorkout = useMutation({
    mutationFn: () => assignWorkoutPlanToTrainee(traineeId, workoutPlan),
    onSuccess: () => {
      setDone(`Assigned ${workoutPlans.data?.find((p) => p.id === workoutPlan)?.title ?? "the workout plan"}.`);
      setWorkoutPlan("");
      queryClient.invalidateQueries({ queryKey: ["trainer-trainee-overview", traineeId] });
    },
  });
  const assignDiet = useMutation({
    mutationFn: () => assignDietPlanToTrainee(traineeId, dietPlan),
    onSuccess: () => {
      setDone(`Assigned ${dietPlans.data?.find((p) => p.id === dietPlan)?.title ?? "the diet plan"}.`);
      setDietPlan("");
    },
  });
  const send = useMutation({
    mutationFn: () => sendNoteToTrainee(traineeId, title.trim(), message.trim() || undefined),
    onSuccess: () => {
      setDone("Message sent — it appears in the member's notifications.");
      setTitle("");
      setMessage("");
    },
  });
  const firstError = [assignWorkout, assignDiet, send].find((m) => m.isError)?.error;

  return (
    <div className="flex flex-col gap-4">
      {done && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" /> {done}
        </p>
      )}
      <FormAlert message={firstError ? errorText(firstError, "Something went wrong") : null} />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Assign workout plan">
          <label htmlFor="assign-workout" className="sr-only">
            Workout plan
          </label>
          <Select
            id="assign-workout"
            value={workoutPlan}
            onChange={setWorkoutPlan}
            disabled={workoutPlans.isPending}
            placeholder={workoutPlans.isPending ? "Loading plans..." : "Choose a plan..."}
            options={(workoutPlans.data ?? []).map((p) => ({ value: p.id, label: p.title }))}
          />
          <Button className="mt-3 w-full" disabled={!workoutPlan || assignWorkout.isPending} onClick={() => assignWorkout.mutate()}>
            <Dumbbell className="h-4 w-4" /> Assign
          </Button>
        </Panel>
        <Panel title="Assign diet plan">
          <label htmlFor="assign-diet" className="sr-only">
            Diet plan
          </label>
          <Select
            id="assign-diet"
            value={dietPlan}
            onChange={setDietPlan}
            disabled={dietPlans.isPending}
            placeholder={dietPlans.isPending ? "Loading plans..." : "Choose a plan..."}
            options={(dietPlans.data ?? []).map((p) => ({ value: p.id, label: p.title }))}
          />
          <Button className="mt-3 w-full" disabled={!dietPlan || assignDiet.isPending} onClick={() => assignDiet.mutate()}>
            <UtensilsCrossed className="h-4 w-4" /> Assign
          </Button>
        </Panel>
      </div>

      <Panel title="Message the member">
        <p className="text-sm text-muted">Unlike private notes, this is sent to the member as a notification.</p>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) send.mutate();
          }}
        >
          <Input aria-label="Message title" placeholder="Title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input aria-label="Message" placeholder="Message (optional)" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
          <Button type="submit" disabled={!title.trim() || send.isPending} className="self-start">
            <Send className="h-4 w-4" /> Send message
          </Button>
        </form>
      </Panel>
    </div>
  );
}

function TraineeDetailContent() {
  const { traineeId } = useParams<{ traineeId: string }>();
  const [tab, setTab] = useState<TabKey>("overview");
  const profile = useQuery({
    queryKey: ["trainer-trainee-profile", traineeId],
    queryFn: () => getTraineeProfile(traineeId),
    retry: (count, err) => !(isAxiosError(err) && [403, 404].includes(err.response?.status ?? 0)) && count < 1,
  });

  if (profile.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center sm:py-24">
        <p className="font-medium">This member isn&apos;t assigned to you, or doesn&apos;t exist.</p>
        <Link href="/trainer" className="mt-3 inline-block text-sm font-semibold text-gold hover:underline">
          Back to my trainees
        </Link>
      </div>
    );
  }

  const p = profile.data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <Link href="/trainer" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold">
        <ArrowLeft className="h-4 w-4" /> My trainees
      </Link>

      <header className="mt-6 flex items-center gap-4">
        {p ? (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gold/15 font-display text-2xl text-gold">
            {(p.name || p.email || "M").charAt(0).toUpperCase()}
          </span>
        ) : (
          <Skeleton className="h-16 w-16 rounded-full" />
        )}
        <div className="min-w-0">
          {p ? <h1 className="truncate text-3xl font-bold uppercase sm:text-4xl">{p.name || p.email || p.phone}</h1> : <Skeleton className="h-9 w-56" />}
          {p && <p className="truncate text-sm text-muted">{p.email ?? p.phone} · member since {date.format(new Date(p.createdAt))}</p>}
        </div>
      </header>

      <div role="tablist" aria-label="Trainee sections" className="mt-8 flex max-w-full overflow-x-auto rounded-xl border border-border bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls="trainee-panel"
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "bg-gold text-accent-foreground" : "text-muted hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="trainee-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-6">
        {tab === "overview" && <OverviewTab traineeId={traineeId} />}
        {tab === "progress" && <ProgressTab traineeId={traineeId} target={p?.targetWeightKg ?? null} />}
        {tab === "workouts" && <WorkoutsTab traineeId={traineeId} />}
        {tab === "visits" && <VisitsTab traineeId={traineeId} />}
        {tab === "notes" && <NotesTab traineeId={traineeId} />}
        {tab === "plans" && <PlansTab traineeId={traineeId} />}
      </div>
    </div>
  );
}

export default function TrainerTraineeDetailPage() {
  return (
    <RequireAuth>
      <TraineeDetailContent />
    </RequireAuth>
  );
}
