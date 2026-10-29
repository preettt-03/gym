"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Camera, CheckCircle2, Dumbbell, ImagePlus, Loader2, Lock, Plus, Scale, Target, Trash2, TrendingDown } from "lucide-react";
import { getDashboard } from "@/lib/api";
import {
  createProgressPhoto,
  deleteProgressPhoto,
  PHOTO_URL_REFRESH_MS,
  listProgressPhotos,
  listWeightLogs,
  listWorkoutHistory,
  logWeight,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  type ProgressPhoto,
} from "@/lib/progress-api";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorNote, MemberHeader, MemberPage, Panel, SegmentedTabs, Tile } from "@/components/member/ui";
import { cn } from "@/lib/utils";

const TZ = "Asia/Kolkata";
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: TZ });
const fullDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const DAY_MS = 24 * 60 * 60 * 1000;
type Range = "30" | "90" | "all";

const errorText = (err: unknown, fallback: string) =>
  isAxiosError(err) ? (err.response?.data?.error?.message as string | undefined) ?? fallback : fallback;

function WeightPanel({ target }: { target: number | null }) {
  const queryClient = useQueryClient();
  const [weight, setWeight] = useState("");
  const [range, setRange] = useState<Range>("90");
  const [now] = useState(() => Date.now());
  const { data: logs, isPending } = useQuery({ queryKey: ["weight-logs"], queryFn: listWeightLogs });

  const value = Number(weight);
  const valid = weight !== "" && Number.isFinite(value) && value >= 25 && value <= 300;

  const add = useMutation({
    mutationFn: () => logWeight(+value.toFixed(1)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weight-logs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setWeight("");
    },
  });

  const points = (logs ?? [])
    .filter((l) => range === "all" || now - new Date(l.loggedAt).getTime() <= Number(range) * DAY_MS)
    .slice()
    .reverse()
    .map((l) => ({ date: shortDate.format(new Date(l.loggedAt)), weight: l.weightKg }));

  return (
    <Panel
      icon={Scale}
      title="Weight trend"
      className="lg:col-span-2"
      action={<SegmentedTabs label="Time range" value={range} onChange={setRange} tabs={[{ key: "30", label: "30d" }, { key: "90", label: "90d" }, { key: "all", label: "All" }]} />}
    >
      <form
        noValidate
        className="flex flex-wrap items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) add.mutate();
        }}
      >
        <div>
          <label htmlFor="weight-input" className="sr-only">
            Today&apos;s weight in kg
          </label>
          <div className="relative">
            <Input
              id="weight-input"
              inputMode="decimal"
              placeholder="Today's weight"
              className="h-10 w-44 pr-10"
              value={weight}
              aria-invalid={weight !== "" && !valid ? true : undefined}
              aria-describedby="weight-hint"
              onChange={(e) => setWeight(e.target.value)}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">kg</span>
          </div>
          <p id="weight-hint" className={cn("mt-1 text-xs", weight !== "" && !valid ? "text-danger" : "text-muted")}>
            {weight !== "" && !valid ? "Enter a weight between 25 and 300 kg" : "Weigh in at the same time of day for a clean trend."}
          </p>
        </div>
        <Button type="submit" size="sm" className="h-10" disabled={!valid || add.isPending}>
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : add.isSuccess ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          Log weight
        </Button>
      </form>
      {add.isError && (
        <div className="mt-3">
          <ErrorNote>{errorText(add.error, "Could not save your weight.")}</ErrorNote>
        </div>
      )}

      <div className="mt-5">
        {isPending ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : points.length === 0 ? (
          <EmptyState icon={Scale} title="No weigh-ins in this range" description="Log your weight to start a trend line." />
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--border)" />
                  <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--border)" />
                  <Tooltip
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}
                    formatter={(v) => [`${v} kg`, "Weight"]}
                  />
                  {target && <ReferenceLine y={target} stroke="var(--muted)" label={{ value: "Target", fill: "var(--muted)", fontSize: 11 }} />}
                  <Line type="monotone" dataKey="weight" stroke="var(--gold)" strokeWidth={2} dot={{ r: 3, fill: "var(--gold)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-xs text-muted hover:text-gold">View data</summary>
              <ul className="mt-2 max-h-48 divide-y divide-border overflow-y-auto">
                {(logs ?? []).map((l) => (
                  <li key={l.id} className="flex justify-between py-1.5">
                    <span>{fullDate.format(new Date(l.loggedAt))}</span>
                    <span className="tabular-nums">{l.weightKg} kg</span>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </div>
    </Panel>
  );
}

function PhotoCard({ photo }: { photo: ProgressPhoto }) {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const remove = useMutation({
    mutationFn: () => deleteProgressPhoto(photo.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["progress-photos"] }),
  });
  return (
    <li className="group relative overflow-hidden rounded-2xl border border-border bg-surface-2">
      {/* Uploaded photos are served from the API host, outside next/image's allowlist. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.photoUrl} alt={photo.notes ? `Progress photo: ${photo.notes}` : "Progress photo"} loading="lazy" className="aspect-[3/4] w-full object-cover" />
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0 text-xs">
          <p className="font-medium">{fullDate.format(new Date(photo.takenAt))}</p>
          {photo.notes && <p className="truncate text-muted">{photo.notes}</p>}
        </div>
        {confirm ? (
          <span className="flex shrink-0 gap-1">
            <Button size="sm" variant="destructive" className="h-8 px-3" disabled={remove.isPending} onClick={() => remove.mutate()}>
              Delete
            </Button>
            <Button size="sm" variant="glass" className="h-8 px-3" onClick={() => setConfirm(false)}>
              Keep
            </Button>
          </span>
        ) : (
          <button type="button" className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger" onClick={() => setConfirm(true)} aria-label="Delete photo">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </li>
  );
}

function PhotosPanel() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const { data: photos, isPending } = useQuery({ queryKey: ["progress-photos"], queryFn: listProgressPhotos, refetchInterval: PHOTO_URL_REFRESH_MS });

  const upload = useMutation({
    mutationFn: (file: File) => createProgressPhoto(file, notes.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progress-photos"] });
      setNotes("");
      if (fileRef.current) fileRef.current.value = "";
    },
  });

  const pick = (file?: File) => {
    setFileError(null);
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return setFileError("Use a JPG, PNG or WebP image.");
    if (file.size > PHOTO_MAX_BYTES) return setFileError("That photo is over 5 MB — try a smaller one.");
    upload.mutate(file);
  };

  return (
    <Panel icon={Camera} title="Progress photos" className="lg:col-span-3">
      <p className="flex items-center gap-2 text-xs text-muted">
        <Lock className="h-3.5 w-3.5 text-gold" /> Your progress photos are private — only you can see them.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="photo-note" className="sr-only">
          Photo note
        </label>
        <Input id="photo-note" maxLength={200} placeholder="Note (optional), e.g. Week 4 — front" value={notes} onChange={(e) => setNotes(e.target.value)} className="sm:flex-1" />
        <input ref={fileRef} type="file" accept={PHOTO_TYPES.join(",")} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <Button type="button" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
          {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {upload.isPending ? "Uploading…" : "Add photo"}
        </Button>
      </div>
      {(fileError || upload.isError) && (
        <div className="mt-3">
          <ErrorNote>{fileError ?? errorText(upload.error, "Could not upload the photo.")}</ErrorNote>
        </div>
      )}

      <div className="mt-5">
        {isPending && <Skeleton className="h-48 rounded-xl" />}
        {photos?.length === 0 && <EmptyState icon={Camera} title="No photos yet" description="Take one every few weeks in the same light and pose — the difference is easier to see than on the scale." />}
        {photos && photos.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {photos.map((p) => (
              <PhotoCard key={p.id} photo={p} />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function HistoryPanel() {
  const { data, isPending } = useQuery({ queryKey: ["workout-history"], queryFn: listWorkoutHistory });
  return (
    <Panel icon={Dumbbell} title="Workout history" action={{ href: "/workout-plans", label: "Plans" }}>
      {isPending && <Skeleton className="h-40 rounded-xl" />}
      {data?.items.length === 0 && <p className="text-sm text-muted">No workouts logged yet. Mark a plan day complete to see it here.</p>}
      {data && data.items.length > 0 && (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {data.items.map((log) => (
            <li key={log.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{log.plan?.title ?? "Workout"}</p>
                {log.day?.title && <p className="truncate text-xs text-muted">{log.day.title}</p>}
              </div>
              <span className="shrink-0 text-xs text-muted">{fullDate.format(new Date(log.date))}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ProgressContent() {
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });
  const { data: logs } = useQuery({ queryKey: ["weight-logs"], queryFn: listWeightLogs });
  const history = useQuery({ queryKey: ["workout-history"], queryFn: listWorkoutHistory });

  const latest = logs?.[0]?.weightKg ?? dashboard.data?.profile.currentWeightKg ?? null;
  const first = logs?.at(-1)?.weightKg ?? null;
  const target = dashboard.data?.profile.targetWeightKg ?? null;
  const change = latest !== null && first !== null ? +(latest - first).toFixed(1) : null;

  return (
    <MemberPage>
      <MemberHeader eyebrow="Your journey" title="Progress" description="Weight, photos and workouts over time — consistency shows up here first." />

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon={Scale} label="Current weight" value={latest ? `${latest} kg` : "—"} sub={logs?.[0] ? `Logged ${shortDate.format(new Date(logs[0].loggedAt))}` : undefined} />
        <Tile icon={TrendingDown} label="Change" value={change === null ? "—" : `${change > 0 ? "+" : ""}${change} kg`} sub={first !== null && logs && logs.length > 1 ? "Since your first weigh-in" : "Needs 2+ weigh-ins"} />
        <Tile icon={Target} label="Target" value={target ? `${target} kg` : "—"} sub={target && latest ? `${Math.abs(+(latest - target).toFixed(1))} kg to go` : "Set it in settings"} />
        <Tile icon={Dumbbell} label="Workouts logged" value={String(history.data?.pagination.total ?? history.data?.items.length ?? 0)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <WeightPanel target={target} />
        <HistoryPanel />
        <PhotosPanel />
      </div>

      {!target && (
        <p className="mt-6 text-sm text-muted">
          Tip: set a target weight in{" "}
          <Link href="/settings" className="font-semibold text-gold hover:underline">
            settings
          </Link>{" "}
          to see it on your chart.
        </p>
      )}
    </MemberPage>
  );
}

export default function ProgressPage() {
  return (
    <RequireAuth>
      <ProgressContent />
    </RequireAuth>
  );
}
