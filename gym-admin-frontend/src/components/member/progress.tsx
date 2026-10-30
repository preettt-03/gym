import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Award, CalendarDays, Coins, Flame, Scale, Sparkles, Target } from "lucide-react";
import { listMemberVisits, type MemberDetail } from "@/lib/member-api";
import { fmtDate, fmtDateTime, istDateInput } from "@/lib/member-ui";
import { Dialog } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/page";
import { Empty, Panel } from "@/components/member/shared";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

const dayLabel = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" });
const WEEKDAYS = ["Mon", "", "Wed", "", "Fri", "", ""];

// ---------------------------------------------------------------------------
// Attendance heatmap
// ---------------------------------------------------------------------------

function VisitsDialog({ member, open, onClose }: { member: MemberDetail; open: boolean; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const { data } = useQuery({ queryKey: ["member-visits", member.id, page], queryFn: () => listMemberVisits(member.id, page), enabled: open, placeholderData: keepPreviousData });
  return (
    <Dialog open={open} onClose={onClose} size="lg" title="All visits" description={data ? `${data.pagination.total} check-ins` : undefined}>
      {data && data.items.length === 0 && <Empty>No visits yet.</Empty>}
      {data && data.items.length > 0 && (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-2 font-medium">Check-in</th>
                <th className="py-2 font-medium">Duration</th>
                <th className="py-2 font-medium">How</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((v) => (
                <tr key={v.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2">{fmtDateTime.format(new Date(v.checkInAt))}</td>
                  <td className="py-2 text-muted">{v.durationMinutes ? `${v.durationMinutes} min` : v.checkOutAt ? "—" : "In gym"}</td>
                  <td className="py-2 text-muted">
                    {v.method === "ADMIN_APPROVED" ? `Desk${v.approvedByAdmin ? ` · ${v.approvedByAdmin.name ?? v.approvedByAdmin.email}` : ""}` : humanize(v.method)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} total={data.pagination.total} onPageChange={setPage} />
        </>
      )}
    </Dialog>
  );
}

export function AttendanceCard({ member }: { member: MemberDetail }) {
  const [open, setOpen] = useState(false);
  const { counts, days, streak } = member.attendanceHeatmap;

  // Columns are weeks (Mon → Sun), oldest on the left, ending with today's week.
  const keys = Array.from({ length: days }, (_, i) => istDateInput(i - days + 1));
  const lead = (new Date(`${keys[0]}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const cells: (string | null)[] = [...Array(lead).fill(null), ...keys];
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const activeDays = Object.keys(counts).length;

  return (
    <Panel
      title="Attendance"
      icon={CalendarDays}
      action={
        <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-gold hover:underline">
          View all visits
        </button>
      }
    >
      <div className="flex flex-wrap gap-6">
        <p>
          <span className="font-display text-3xl font-bold text-gold">{streak}</span>
          <span className="ml-1.5 text-sm text-muted">day streak</span>
        </p>
        <p>
          <span className="font-display text-3xl font-bold">{activeDays}</span>
          <span className="ml-1.5 text-sm text-muted">days trained in the last {Math.round(days / 7)} weeks</span>
        </p>
      </div>
      <div className="mt-4 overflow-x-auto pb-1">
        <div className="inline-flex gap-[3px]" role="img" aria-label={`${total} check-ins over ${activeDays} days in the last ${days} days`}>
          <div className="mr-1 flex flex-col gap-[3px] pt-4 text-[9px] text-muted">
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="flex h-3.5 items-center">
                {d}
              </span>
            ))}
          </div>
          {weeks.map((week, w) => {
            const first = week.find(Boolean);
            const showMonth = first && (w === 0 || first.slice(8) <= "07");
            return (
              <div key={w} className="flex flex-col gap-[3px]">
                <span className="h-4 text-[9px] text-muted">{showMonth ? monthLabel.format(new Date(`${first}T00:00:00Z`)) : ""}</span>
                {Array.from({ length: 7 }, (_, d) => {
                  const key = week[d];
                  if (!key) return <span key={d} className="h-3.5 w-3.5" />;
                  const n = counts[key] ?? 0;
                  return (
                    <span
                      key={d}
                      title={`${dayLabel.format(new Date(`${key}T00:00:00Z`))}: ${n ? `${n} visit${n === 1 ? "" : "s"}` : "no visit"}`}
                      className={cn("h-3.5 w-3.5 rounded-[3px]", n === 0 ? "bg-surface-2" : n === 1 ? "bg-gold/55" : "bg-gold", key === keys.at(-1) && "ring-1 ring-foreground/60")}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted" aria-hidden>
        No visit <span className="h-2.5 w-2.5 rounded-[2px] bg-surface-2" /> <span className="h-2.5 w-2.5 rounded-[2px] bg-gold/55" /> 1 <span className="h-2.5 w-2.5 rounded-[2px] bg-gold" /> 2+
      </div>
      <VisitsDialog member={member} open={open} onClose={() => setOpen(false)} />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Weight trajectory
// ---------------------------------------------------------------------------

const W = 600;
const H = 220;
const PAD = { left: 40, right: 16, top: 16, bottom: 26 };

export function WeightCard({ member }: { member: MemberDetail }) {
  const series = member.weightSeries.map((p) => ({ t: new Date(p.loggedAt).getTime(), kg: p.weightKg, at: p.loggedAt }));
  const target = member.targetWeightKg;

  if (series.length < 2) {
    return (
      <Panel title="Weight" icon={Scale}>
        <Empty>{series.length === 1 ? `One log so far: ${series[0].kg} kg on ${fmtDate.format(new Date(series[0].at))}.` : "No weight logged yet."} The chart appears after two logs.</Empty>
      </Panel>
    );
  }

  const values = [...series.map((p) => p.kg), ...(target ? [target] : [])];
  const lo = Math.floor(Math.min(...values) - 1);
  const hi = Math.ceil(Math.max(...values) + 1);
  const t0 = series[0].t;
  const t1 = series.at(-1)!.t;
  const x = (t: number) => PAD.left + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD.left - PAD.right);
  const y = (kg: number) => PAD.top + (1 - (kg - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const ticks = Array.from({ length: 4 }, (_, i) => +(lo + ((hi - lo) * i) / 3).toFixed(1));
  const path = series.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");
  const change = +(series.at(-1)!.kg - series[0].kg).toFixed(1);
  const toGo = target ? +(series.at(-1)!.kg - target).toFixed(1) : null;

  return (
    <Panel title="Weight" icon={Scale}>
      <div className="flex flex-wrap gap-6 text-sm">
        <p>
          <span className="font-display text-3xl font-bold text-gold">{series.at(-1)!.kg}</span>
          <span className="ml-1 text-muted">kg now</span>
        </p>
        <p>
          <span className="font-display text-3xl font-bold">{change > 0 ? `+${change}` : change}</span>
          <span className="ml-1 text-muted">kg since {fmtDate.format(new Date(series[0].at))}</span>
        </p>
        {toGo !== null && (
          <p className="flex items-center gap-1.5 text-muted">
            <Target className="h-4 w-4 text-gold" /> {toGo === 0 ? "At target" : `${Math.abs(toGo)} kg to target (${target} kg)`}
          </p>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-auto w-full" role="img" aria-label={`Weight from ${series[0].kg} kg to ${series.at(-1)!.kg} kg${target ? `, target ${target} kg` : ""}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#2c2c2a" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="fill-[var(--muted)] text-[10px]">
              {t}
            </text>
          </g>
        ))}
        {target && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} stroke="var(--success)" strokeWidth="1.5" strokeDasharray="6 4" />
            <text x={W - PAD.right} y={y(target) - 5} textAnchor="end" className="fill-[var(--success)] text-[10px] font-semibold">
              Target {target} kg
            </text>
          </g>
        )}
        <path d={path} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((p) => (
          <circle key={p.at} cx={x(p.t)} cy={y(p.kg)} r="4" fill="var(--gold)" stroke="var(--surface)" strokeWidth="2">
            <title>{`${fmtDate.format(new Date(p.at))}: ${p.kg} kg`}</title>
          </circle>
        ))}
        <text x={PAD.left} y={H - 6} className="fill-[var(--muted)] text-[10px]">
          {fmtDate.format(new Date(series[0].at))}
        </text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-[var(--muted)] text-[10px]">
          {fmtDate.format(new Date(series.at(-1)!.at))}
        </text>
      </svg>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs text-muted hover:text-foreground">View data</summary>
        <table className="mt-2 w-full text-xs">
          <tbody>
            {[...series].reverse().map((p) => (
              <tr key={p.at} className="border-b border-border/60 last:border-0">
                <td className="py-1.5">{fmtDate.format(new Date(p.at))}</td>
                <td className="py-1.5 text-right tabular-nums">{p.kg} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Gamification
// ---------------------------------------------------------------------------

export function GamificationCard({ member }: { member: MemberDetail }) {
  const g = member.gamification;
  const missionPct = g.missions.active ? Math.round((g.missions.completed / g.missions.active) * 100) : 0;
  const stats = [
    { icon: Sparkles, label: "XP", value: member.xp.toLocaleString("en-IN") },
    { icon: Coins, label: "Coins", value: member.coins.toLocaleString("en-IN") },
    { icon: Flame, label: "App streak", value: `${g.streak.currentStreak}d`, sub: `best ${g.streak.longestStreak}d` },
  ];
  return (
    <Panel title="Rewards & activity" icon={Award}>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface-2/50 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <s.icon className="h-3.5 w-3.5 text-gold" /> {s.label}
            </p>
            <p className="mt-1 font-display text-xl font-bold">{s.value}</p>
            {s.sub && <p className="text-[11px] text-muted">{s.sub}</p>}
          </div>
        ))}
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs">
          <span className="text-muted">Active missions completed</span>
          <span className="font-semibold">
            {g.missions.completed} / {g.missions.active}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-gold" style={{ width: `${missionPct}%` }} />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs text-muted">Badges ({g.badges.length})</p>
        {g.badges.length ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {g.badges.map((b) => (
              <li key={b.id} title={`Earned ${fmtDate.format(new Date(b.awardedAt))}`} className="flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 py-1 pl-1 pr-2.5 text-xs">
                {b.iconUrl ? <img src={b.iconUrl} alt="" className="h-5 w-5 rounded-full object-cover" /> : <Award className="ml-1 h-3.5 w-3.5 text-gold" />}
                {b.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted">None yet.</p>
        )}
      </div>
    </Panel>
  );
}
