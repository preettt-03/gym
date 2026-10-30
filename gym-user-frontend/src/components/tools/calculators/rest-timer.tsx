"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Pause, Play, Plus, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Guide, NumberField, readNumber } from "@/components/tools/ui";
import { cn } from "@/lib/utils";

const PRESETS = [30, 45, 60, 90, 120, 180];
const RING = 2 * Math.PI * 88;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

// Short tone through Web Audio — no audio file to download.
function beep(ctx: AudioContext | null, frequency: number, ms: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + ms / 1000);
}

/**
 * Counts down from an end timestamp rather than ticking a counter, so it
 * stays correct when the tab is in the background.
 */
export function RestTimer() {
  const [duration, setDuration] = useState(90);
  const [endAt, setEndAt] = useState<number | null>(null);
  // Seconds left while paused / before starting.
  const [left, setLeft] = useState(90);
  const [now, setNow] = useState(() => Date.now());
  const [sets, setSets] = useState(0);
  const [sound, setSound] = useState(true);
  const [custom, setCustom] = useState("");
  const [customError, setCustomError] = useState<string>();
  const audioRef = useRef<AudioContext | null>(null);
  const lastBeep = useRef<number | null>(null);

  const running = endAt !== null;
  const remaining = running ? Math.max(0, Math.ceil((endAt - now) / 1000)) : left;

  useEffect(() => {
    if (endAt === null) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const secs = Math.ceil((endAt - t) / 1000);
      if (secs <= 3 && secs > 0 && lastBeep.current !== secs) {
        lastBeep.current = secs;
        if (sound) beep(audioRef.current, 660, 120);
      }
      if (secs <= 0) {
        window.clearInterval(id);
        if (sound) beep(audioRef.current, 880, 600);
        navigator.vibrate?.([200, 100, 200]);
        setEndAt(null);
        setLeft(0);
        setSets((s) => s + 1);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [endAt, sound]);

  const start = (secs = remaining > 0 ? remaining : duration) => {
    // Browsers only allow audio after a user gesture, so create it here.
    audioRef.current ??= typeof AudioContext !== "undefined" ? new AudioContext() : null;
    void audioRef.current?.resume();
    lastBeep.current = null;
    const t = Date.now();
    setNow(t);
    setEndAt(t + secs * 1000);
  };
  const pause = () => {
    setLeft(remaining);
    setEndAt(null);
  };
  const reset = (secs = duration) => {
    setEndAt(null);
    setLeft(secs);
  };
  const pick = (secs: number) => {
    setDuration(secs);
    reset(secs);
  };
  const adjust = (delta: number) => {
    const next = Math.max(5, remaining + delta);
    if (running) setEndAt((e) => (e ?? Date.now()) + delta * 1000);
    else setLeft(next);
  };

  const progress = duration ? Math.min(1, remaining / duration) : 0;
  const done = !running && left === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
      <section className="glass-card flex flex-col items-center p-6 sm:p-8">
        <div className="relative h-56 w-56 sm:h-64 sm:w-64">
          <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="100" cy="100" r="88" fill="none" stroke="var(--surface-2)" strokeWidth="10" />
            <circle
              cx="100"
              cy="100"
              r="88"
              fill="none"
              stroke="var(--gold)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - progress)}
              className="transition-[stroke-dashoffset] duration-200 ease-linear"
              style={{ filter: "drop-shadow(0 0 8px rgba(229,192,123,0.45))" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span role="timer" aria-live={remaining <= 3 || done ? "assertive" : "off"} className={cn("font-display text-6xl font-bold tabular-nums", done ? "text-gold" : "text-foreground")}>
              {done ? "GO!" : clock(remaining)}
            </span>
            <span className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">{done ? "Next set" : running ? "Resting" : "Ready"}</span>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button variant="glass" className="h-11 w-11 p-0" onClick={() => adjust(-15)} aria-label="15 seconds less">
            <Minus className="h-4 w-4" />
          </Button>
          {running ? (
            <Button className="h-12 min-w-36 uppercase tracking-wider" onClick={pause}>
              <Pause className="h-4 w-4" /> Pause
            </Button>
          ) : (
            <Button className="h-12 min-w-36 uppercase tracking-wider" onClick={() => start(done ? duration : undefined)}>
              <Play className="h-4 w-4" /> {done ? "Start again" : left < duration ? "Resume" : "Start"}
            </Button>
          )}
          <Button variant="glass" className="h-11 w-11 p-0" onClick={() => adjust(15)} aria-label="15 seconds more">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4 flex items-center gap-4 text-sm">
          <button type="button" onClick={() => reset()} className="flex items-center gap-1.5 text-muted hover:text-foreground">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
          <button type="button" onClick={() => setSound((s) => !s)} aria-pressed={sound} className="flex items-center gap-1.5 text-muted hover:text-foreground">
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Sound {sound ? "on" : "off"}
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <section className="glass-card p-6">
          <p className="text-sm font-medium">Rest length</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={duration === p}
                onClick={() => pick(p)}
                className={cn(
                  "rounded-xl border py-2.5 font-display text-lg font-bold transition-colors",
                  duration === p ? "border-gold bg-gold text-accent-foreground" : "border-border bg-surface-2 text-foreground/80 hover:border-gold/40"
                )}
              >
                {p < 60 ? `${p}s` : clock(p)}
              </button>
            ))}
          </div>
          <form
            noValidate
            className="mt-4 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const r = readNumber(custom, "Rest", 5, 900, "seconds");
              setCustomError(r.error);
              if (!r.error) pick(Math.round(r.value!));
            }}
          >
            <div className="flex-1">
              <NumberField id="custom" label="Custom" unit="sec" value={custom} onChange={setCustom} error={customError} placeholder="e.g. 150" />
            </div>
            <Button type="submit" variant="glass" className="h-11">
              Set
            </Button>
          </form>
          <div className="mt-5 flex items-center justify-between rounded-xl border border-border bg-surface-2/50 px-4 py-3">
            <span className="text-sm text-muted">Rests completed</span>
            <span className="flex items-center gap-3">
              <span className="font-display text-2xl font-bold text-gold tabular-nums">{sets}</span>
              {sets > 0 && (
                <button type="button" onClick={() => setSets(0)} className="text-xs text-muted hover:text-foreground">
                  Clear
                </button>
              )}
            </span>
          </div>
        </section>
        <Guide
          title="How long to rest"
          tips={["Heavy strength work (1–5 reps): 2–3 minutes.", "Muscle building (6–12 reps): 60–90 seconds.", "Endurance and circuits: 30–45 seconds.", "Beeps count down the last 3 seconds; your phone vibrates at zero."]}
        />
      </div>
    </div>
  );
}
