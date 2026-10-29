"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Award, Flame, Target, Trophy } from "lucide-react";
import { format } from "date-fns";
import { getMyStreak, listActiveMissions, listMyBadges, reportMissionProgress } from "@/lib/gamification-api";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/require-auth";

function MissionCard({ mission }: { mission: Awaited<ReturnType<typeof listActiveMissions>>[number] }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");

  const mutation = useMutation({
    mutationFn: (v: number) => reportMissionProgress(mission.id, v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setValue("");
    },
  });

  const pct = Math.min(100, Math.round((mission.progress.currentValue / mission.targetValue) * 100));

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <CardTitle>{mission.title}</CardTitle>
        {mission.progress.isCompleted && <Trophy className="h-4 w-4 text-accent-2" />}
      </div>
      {mission.description && <CardDescription>{mission.description}</CardDescription>}

      <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full accent-gradient" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-muted">
        {mission.progress.currentValue} / {mission.targetValue} · +{mission.rewardCoins} coins, +{mission.rewardXp} XP
      </div>

      {!mission.progress.isCompleted && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = Number(value);
            if (v > 0) mutation.mutate(v);
          }}
        >
          <Input
            type="number"
            placeholder="Log progress"
            className="h-9 px-3 text-sm"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={mutation.isPending || !value}>
            Add
          </Button>
        </form>
      )}
    </Card>
  );
}

function AchievementsContent() {
  const { data: streak } = useQuery({ queryKey: ["streak"], queryFn: getMyStreak });
  const { data: missions } = useQuery({ queryKey: ["missions"], queryFn: listActiveMissions });
  const { data: badges } = useQuery({ queryKey: ["badges"], queryFn: listMyBadges });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-semibold">
        Achievements
      </motion.h1>
      <p className="mt-1 text-muted">Streaks, missions, and badges you&apos;ve earned.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full accent-gradient text-accent-foreground">
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-semibold">{streak?.currentStreak ?? 0} days</div>
            <div className="text-xs text-muted">Longest: {streak?.longestStreak ?? 0}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full accent-gradient text-accent-foreground">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-semibold">{badges?.length ?? 0} badges</div>
            <div className="text-xs text-muted">Earned so far</div>
          </div>
        </Card>
      </div>

      {badges && badges.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 text-sm font-medium uppercase tracking-wide text-muted">Badges</h2>
          <div className="flex flex-wrap gap-3">
            {badges.map((b) => (
              <div key={b.id} className="glass-card flex items-center gap-2 px-4 py-3">
                <Award className="h-4 w-4 text-accent" />
                <div>
                  <div className="text-sm font-medium">{b.badge.name}</div>
                  <div className="text-xs text-muted">{format(new Date(b.awardedAt), "PP")}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-10 mb-3 flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-muted">
        <Target className="h-3.5 w-3.5" /> Active missions
      </h2>
      {missions?.length === 0 && (
        <Card>
          <CardDescription>No active missions right now.</CardDescription>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {missions?.map((m) => (
          <MissionCard key={m.id} mission={m} />
        ))}
      </div>
    </div>
  );
}

export default function AchievementsPage() {
  return (
    <RequireAuth>
      <AchievementsContent />
    </RequireAuth>
  );
}
