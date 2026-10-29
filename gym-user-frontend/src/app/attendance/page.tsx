"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { CalendarCheck, Clock, DoorClosed, DoorOpen, Loader2, Timer, TrendingUp } from "lucide-react";
import { checkIn, checkOut, getStatus, listMyAttendance, type Attendance } from "@/lib/attendance-api";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorNote, MemberHeader, MemberPage, Panel, Tile } from "@/components/member/ui";
import { cn, humanize } from "@/lib/utils";

const TZ = "Asia/Kolkata";
const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ });
const dayLabel = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: TZ });

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}

// Re-renders every 30 s so the in-gym timer stays current.
function useNow(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return now;
}

function VisitCalendar({ visits, now }: { visits: Attendance[]; now: number }) {
  const visited = new Set(visits.map((v) => dayKey(new Date(v.checkInAt))));
  // Last 5 weeks, oldest first, aligned so each column is a weekday.
  const days = Array.from({ length: 35 }, (_, i) => new Date(now - (34 - i) * DAY_MS));
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-muted" aria-hidden="true">
        {days.slice(0, 7).map((d) => (
          <span key={d.toISOString()}>{new Intl.DateTimeFormat("en-IN", { weekday: "narrow", timeZone: TZ }).format(d)}</span>
        ))}
      </div>
      <ul className="mt-1.5 grid grid-cols-7 gap-1.5" aria-label="Visits in the last 5 weeks">
        {days.map((d) => {
          const key = dayKey(d);
          const went = visited.has(key);
          return (
            <li
              key={key}
              title={`${dayLabel.format(d)} — ${went ? "visited" : "no visit"}`}
              aria-label={`${dayLabel.format(d)}: ${went ? "visited" : "no visit"}`}
              className={cn("aspect-square rounded-md", went ? "bg-gold" : "bg-surface-2", key === dayKey(new Date(now)) && "ring-2 ring-foreground/40")}
            />
          );
        })}
      </ul>
      <p className="mt-3 flex items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-gold" /> Visited
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-surface-2" /> No visit
        </span>
      </p>
    </div>
  );
}

function AttendanceContent() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ["attendance-status"], queryFn: getStatus });
  const history = useQuery({ queryKey: ["attendance-history"], queryFn: listMyAttendance });
  const checkedIn = Boolean(status.data?.checkedIn);
  const now = useNow(checkedIn);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["attendance-status"] });
    queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const doCheckIn = useMutation({ mutationFn: checkIn, onSuccess: refresh });
  const doCheckOut = useMutation({ mutationFn: checkOut, onSuccess: refresh });
  const error = doCheckIn.error ?? doCheckOut.error;
  const errorMessage = error
    ? isAxiosError(error)
      ? error.response?.data?.error?.message ?? "Something went wrong. Please try again."
      : "Something went wrong. Please try again."
    : null;

  const visits = history.data ?? [];
  const monthKey = dayKey(new Date(now)).slice(0, 7);
  const thisMonth = visits.filter((v) => dayKey(new Date(v.checkInAt)).startsWith(monthKey));
  const completed = visits.filter((v) => v.durationMinutes);
  const avg = completed.length ? completed.reduce((s, v) => s + (v.durationMinutes ?? 0), 0) / completed.length : 0;
  const weekVisits = new Set(visits.filter((v) => now - new Date(v.checkInAt).getTime() < 7 * DAY_MS).map((v) => dayKey(new Date(v.checkInAt)))).size;
  const since = status.data?.attendance ? (now - new Date(status.data.attendance.checkInAt).getTime()) / 60000 : 0;

  const byMonth = visits.reduce<Record<string, Attendance[]>>((acc, v) => {
    const key = monthLabel.format(new Date(v.checkInAt));
    (acc[key] ??= []).push(v);
    return acc;
  }, {});

  return (
    <MemberPage>
      <MemberHeader eyebrow="Gym floor" title="Attendance" description="Check in when you arrive and check out when you leave — every visit counts toward your streak." />

      <section className={cn("mt-8 flex flex-col items-center gap-5 rounded-2xl border p-8 text-center sm:flex-row sm:text-left", checkedIn ? "border-success/40 bg-success/5" : "border-gold/30 bg-surface")}>
        <span className={cn("flex h-20 w-20 shrink-0 items-center justify-center rounded-full", checkedIn ? "bg-success/15" : "bg-gold/15")}>
          {checkedIn ? <DoorOpen className="h-9 w-9 text-success" /> : <DoorClosed className="h-9 w-9 text-gold" />}
        </span>
        <div className="flex-1">
          {status.isPending ? (
            <Skeleton className="h-12 w-60" />
          ) : checkedIn && status.data?.attendance ? (
            <>
              <h2 className="text-2xl font-bold uppercase">You&apos;re in the gym</h2>
              <p className="mt-1 text-muted">
                Checked in at {time.format(new Date(status.data.attendance.checkInAt))} · {formatDuration(since)} so far
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold uppercase">Not checked in</h2>
              <p className="mt-1 text-muted">Arrived at King&apos;s Fitness? Check in to log today&apos;s visit.</p>
            </>
          )}
          {errorMessage && (
            <div className="mt-3">
              <ErrorNote>{errorMessage}</ErrorNote>
            </div>
          )}
        </div>
        {checkedIn ? (
          <Button size="lg" variant="outline" disabled={doCheckOut.isPending} onClick={() => doCheckOut.mutate()} className="uppercase tracking-wider">
            {doCheckOut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Check out
          </Button>
        ) : (
          <Button size="lg" disabled={doCheckIn.isPending || status.isPending} onClick={() => doCheckIn.mutate()} className="uppercase tracking-wider">
            {doCheckIn.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Check in
          </Button>
        )}
      </section>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon={CalendarCheck} label="Visits this month" value={String(thisMonth.length)} />
        <Tile icon={TrendingUp} label="Days this week" value={`${weekVisits} / 7`} />
        <Tile icon={Timer} label="Average session" value={avg ? formatDuration(avg) : "—"} sub={completed.length ? `Across ${completed.length} visits` : "Check out to record time"} />
        <Tile icon={Clock} label="Total visits" value={String(visits.length)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <Panel icon={CalendarCheck} title="Last 5 weeks">
          {history.isPending ? <Skeleton className="h-56 rounded-xl" /> : <VisitCalendar visits={visits} now={now} />}
        </Panel>

        <Panel icon={Clock} title="History">
          {history.isPending && <Skeleton className="h-56 rounded-xl" />}
          {history.isError && <ErrorNote>Could not load your visits.</ErrorNote>}
          {history.data?.length === 0 && <EmptyState icon={DoorOpen} title="No visits yet" description="Your check-ins will show up here." />}
          {visits.length > 0 && (
            <div className="flex max-h-[28rem] flex-col gap-5 overflow-y-auto pr-1">
              {Object.entries(byMonth).map(([month, list]) => (
                <section key={month} aria-label={month}>
                  <h3 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-widest text-gold">
                    {month} · {list.length} visit{list.length === 1 ? "" : "s"}
                  </h3>
                  <ul className="divide-y divide-border">
                    {list.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <div>
                          <p className="font-medium">{dayLabel.format(new Date(v.checkInAt))}</p>
                          <p className="text-xs text-muted">
                            {time.format(new Date(v.checkInAt))} – {v.checkOutAt ? time.format(new Date(v.checkOutAt)) : "in progress"}
                            {v.method !== "QR" && ` · ${humanize(v.method)}`}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted">{v.durationMinutes ? formatDuration(v.durationMinutes) : "—"}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </MemberPage>
  );
}

export default function AttendancePage() {
  return (
    <RequireAuth>
      <AttendanceContent />
    </RequireAuth>
  );
}
