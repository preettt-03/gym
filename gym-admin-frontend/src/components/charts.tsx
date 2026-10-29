import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatDay } from "@/lib/format";

// Lightweight SVG charts for the dashboard. Single-series charts use the
// brand gold; marks follow fixed specs (2px lines, <=24px columns with a 4px
// rounded data end, hairline solid grid) and every chart has a hover/keyboard
// tooltip plus a table view, so no value is reachable by color or hover alone.

const GRID = "#2c2c2a";
const AXIS = "#383835";
const SERIES = "var(--gold)";
const PLOT_HEIGHT = 200;
const AXIS_BAND = 24;
const LEFT = 44;
const RIGHT = 12;
const TOP = 12;

export interface Point {
  date: string; // YYYY-MM-DD
  value: number;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

// Clean axis maximum with four round steps (0 / 25 / 50 / 75 / 100 style).
function niceScale(max: number, integer: boolean) {
  if (max <= 0) return { top: integer ? 4 : 1, step: integer ? 1 : 0.25 };
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  let step = ([1, 2, 2.5, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow;
  if (integer) step = Math.max(1, Math.ceil(step));
  return { top: Math.ceil(max / step) * step, step };
}

function xTickIndexes(count: number, width: number) {
  const target = Math.max(2, Math.min(7, Math.floor(width / 90)));
  if (count <= target) return Array.from({ length: count }, (_, i) => i);
  const every = Math.ceil((count - 1) / (target - 1));
  const out: number[] = [];
  for (let i = count - 1; i >= 0; i -= every) out.unshift(i);
  return out;
}

interface ChartProps {
  data: Point[];
  label: string; // what one value is, e.g. "Revenue"
  format: (n: number) => string;
  integer?: boolean;
}

function Tooltip({ x, plotWidth, date, value }: { x: number; plotWidth: number; date: string; value: string }) {
  const flip = x > plotWidth * 0.7;
  return (
    <div
      className="pointer-events-none absolute top-1 z-10 rounded-lg border border-border bg-background/95 px-3 py-2 shadow-xl"
      style={{ left: x + LEFT, transform: flip ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
    >
      <div className="text-sm font-semibold text-foreground">{value}</div>
      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
        <span className="h-0.5 w-3 rounded-full" style={{ background: SERIES }} />
        {formatDay(date)}
      </div>
    </div>
  );
}

// Shared frame: gridlines, y ticks, x ticks, keyboard/pointer index tracking.
function useChartFrame(data: Point[], width: number, integer: boolean) {
  const [active, setActive] = useState<number | null>(null);
  const plotWidth = Math.max(0, width - LEFT - RIGHT);
  const { top, step } = niceScale(Math.max(...data.map((d) => d.value), 0), integer);
  const y = (v: number) => TOP + PLOT_HEIGHT - (v / top) * PLOT_HEIGHT;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!data.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 1 : -1;
      setActive((i) => Math.min(data.length - 1, Math.max(0, (i ?? data.length - 1) + delta)));
    } else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(data.length - 1);
  };

  return { active, setActive, plotWidth, y, ticks, onKeyDown };
}

function Axes({
  ticks,
  y,
  plotWidth,
  data,
  xFor,
  format,
}: {
  ticks: number[];
  y: (v: number) => number;
  plotWidth: number;
  data: Point[];
  xFor: (i: number) => number;
  format: (n: number) => string;
}) {
  return (
    <>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={LEFT} x2={LEFT + plotWidth} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
          <text x={LEFT - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
            {format(t)}
          </text>
        </g>
      ))}
      {xTickIndexes(data.length, plotWidth).map((i) => (
        <text
          key={i}
          x={LEFT + xFor(i)}
          y={TOP + PLOT_HEIGHT + 16}
          textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
          className="fill-muted text-[11px]"
        >
          {formatDay(data[i].date)}
        </text>
      ))}
    </>
  );
}

export function AreaChart({ data, label, format, integer = false }: ChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const gradientId = useId();
  const { active, setActive, plotWidth, y, ticks, onKeyDown } = useChartFrame(data, width, integer);
  const xFor = (i: number) => (data.length <= 1 ? plotWidth / 2 : (i / (data.length - 1)) * plotWidth);

  const line = data.map((d, i) => `${i ? "L" : "M"}${LEFT + xFor(i)},${y(d.value)}`).join(" ");
  const area = `${line} L${LEFT + xFor(data.length - 1)},${y(0)} L${LEFT + xFor(0)},${y(0)} Z`;
  const last = data.at(-1);

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - LEFT;
    const i = Math.round((px / plotWidth) * (data.length - 1));
    setActive(Math.min(data.length - 1, Math.max(0, i)));
  };

  return (
    <div ref={ref} className="relative">
      {width > 0 && data.length > 0 && (
        <svg
          width={width}
          height={TOP + PLOT_HEIGHT + AXIS_BAND}
          role="img"
          tabIndex={0}
          aria-label={`${label} by day, ${formatDay(data[0].date)} to ${formatDay(last!.date)}. Use arrow keys to read values.`}
          className="block touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(data.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={onKeyDown}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={SERIES} stopOpacity={0.18} />
              <stop offset="100%" stopColor={SERIES} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Axes ticks={ticks} y={y} plotWidth={plotWidth} data={data} xFor={xFor} format={format} />
          <path d={area} fill={`url(#${gradientId})`} />
          <path d={line} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {active !== null && (
            <g>
              <line x1={LEFT + xFor(active)} x2={LEFT + xFor(active)} y1={TOP} y2={y(0)} stroke={AXIS} strokeWidth={1} />
              <circle cx={LEFT + xFor(active)} cy={y(data[active].value)} r={5} fill={SERIES} stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
          {active === null && last && (
            <circle cx={LEFT + xFor(data.length - 1)} cy={y(last.value)} r={4} fill={SERIES} stroke="var(--surface)" strokeWidth={2} />
          )}
        </svg>
      )}
      {active !== null && data[active] && (
        <Tooltip x={xFor(active)} plotWidth={plotWidth} date={data[active].date} value={format(data[active].value)} />
      )}
    </div>
  );
}

export function ColumnChart({ data, label, format, integer = true }: ChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { active, setActive, plotWidth, y, ticks, onKeyDown } = useChartFrame(data, width, integer);
  const band = data.length ? plotWidth / data.length : 0;
  const barWidth = Math.max(2, Math.min(24, band - 2));
  const xFor = (i: number) => i * band + band / 2;

  return (
    <div ref={ref} className="relative">
      {width > 0 && data.length > 0 && (
        <svg
          width={width}
          height={TOP + PLOT_HEIGHT + AXIS_BAND}
          role="img"
          tabIndex={0}
          aria-label={`${label} by day, ${formatDay(data[0].date)} to ${formatDay(data.at(-1)!.date)}. Use arrow keys to read values.`}
          className="block touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(data.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={onKeyDown}
        >
          <Axes ticks={ticks} y={y} plotWidth={plotWidth} data={data} xFor={xFor} format={format} />
          {data.map((d, i) => {
            const h = y(0) - y(d.value);
            const x = LEFT + xFor(i) - barWidth / 2;
            const r = Math.min(4, barWidth / 2, h);
            return (
              <g key={d.date} onPointerEnter={() => setActive(i)}>
                {/* Full-height hit area so short bars are still easy to hover. */}
                <rect x={LEFT + i * band} y={TOP} width={band} height={PLOT_HEIGHT} fill="transparent" />
                {h > 0 && (
                  <path
                    d={`M${x},${y(0)} V${y(d.value) + r} Q${x},${y(d.value)} ${x + r},${y(d.value)} H${x + barWidth - r} Q${x + barWidth},${y(d.value)} ${x + barWidth},${y(d.value) + r} V${y(0)} Z`}
                    fill={SERIES}
                    opacity={active === null || active === i ? 1 : 0.45}
                  />
                )}
              </g>
            );
          })}
        </svg>
      )}
      {active !== null && data[active] && (
        <Tooltip x={xFor(active)} plotWidth={plotWidth} date={data[active].date} value={format(data[active].value)} />
      )}
    </div>
  );
}

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Part-to-whole for a handful of states. Each segment is separated by a 2px
// surface gap; the legend carries icon + label + count so color is never alone.
export function Donut({ segments, centerLabel }: { segments: DonutSegment[]; centerLabel: string }) {
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  const size = 168;
  const radius = 66;
  const stroke = 18;
  const circumference = 2 * Math.PI * radius;
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;
  let offset = 0;
  const shown = active ? segments.find((s) => s.key === active) : null;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={GRID} strokeWidth={stroke} />
          {total > 0 &&
            segments.map((s) => {
              const length = (s.value / total) * circumference;
              const dash = Math.max(0, length - gap);
              const el = (
                <circle
                  key={s.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={active === s.key ? stroke + 4 : stroke}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  className="transition-[stroke-width] duration-200"
                  onPointerEnter={() => setActive(s.key)}
                  onPointerLeave={() => setActive(null)}
                />
              );
              offset += length;
              return s.value > 0 ? el : null;
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-semibold">{shown ? shown.value : total}</span>
          <span className="max-w-24 text-xs text-muted">{shown ? shown.label : centerLabel}</span>
        </div>
      </div>

      <ul className="flex w-full flex-col gap-2.5">
        {segments.map((s) => (
          <li
            key={s.key}
            onPointerEnter={() => setActive(s.key)}
            onPointerLeave={() => setActive(null)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors",
              active === s.key && "bg-foreground/5"
            )}
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `color-mix(in srgb, ${s.color} 18%, transparent)` }}>
                <s.icon className="h-3.5 w-3.5" />
              </span>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </span>
            <span className="font-semibold tabular-nums">
              {s.value}
              <span className="ml-1.5 text-xs font-normal text-muted">{total ? Math.round((s.value / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Collapsible table twin for a chart — the accessible, hover-free way to read every value.
export function DataTable({ data, valueLabel, format }: { data: Point[]; valueLabel: string; format: (n: number) => string }) {
  return (
    <details className="group mt-3 text-sm">
      <summary className="cursor-pointer select-none text-xs font-medium text-muted hover:text-gold">View data</summary>
      <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Date</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((d) => (
              <tr key={d.date} className="border-t border-border">
                <td className="px-3 py-1.5">{formatDay(d.date)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
