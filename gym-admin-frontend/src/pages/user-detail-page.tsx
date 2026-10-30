import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowLeft, CalendarCheck, Dumbbell, UtensilsCrossed, UserRound } from "lucide-react";
import { getMemberDetail } from "@/lib/member-api";
import { useAuthStore } from "@/stores/auth-store";
import { Skeleton } from "@/components/ui/skeleton";
import { humanize } from "@/lib/format";
import { MemberHeader, RiskBanner } from "@/components/member/header";
import { MembershipCard, PaymentsCard, RecordPaymentDialog } from "@/components/member/membership";
import { AccessCard, AssignPlanDialog, FacilityCard, PlansCard, PtCard } from "@/components/member/training";
import { AttendanceCard, GamificationCard, WeightCard } from "@/components/member/progress";
import { MedicalCard, NotesCard, TimelineCard } from "@/components/member/activity";
import { MemberCardDialog } from "@/components/member/member-card";
import { Panel } from "@/components/member/shared";

function Stat({ icon: Icon, label, value }: { icon: typeof Dumbbell; label: string; value: string }) {
  return (
    <div className="glass-card flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10">
        <Icon className="h-4 w-4 text-gold" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-xs text-muted">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    </div>
  );
}

export function UserDetailPage() {
  const { id = "" } = useParams();
  const currentAdminId = useAuthStore((s) => s.user?.id);
  const [payment, setPayment] = useState<{ open: boolean; planId?: string }>({ open: false });
  const [assign, setAssign] = useState<{ open: boolean; kind?: "workout" | "diet" }>({ open: false });
  const [card, setCard] = useState(false);
  const { data: member, isPending, error } = useQuery({
    queryKey: ["admin-user", id],
    queryFn: () => getMemberDetail(id),
    retry: (count, err) => !(isAxiosError(err) && err.response?.status === 404) && count < 1,
  });

  return (
    <div className="mx-auto max-w-7xl">
      <Link to="/users" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold">
        <ArrowLeft className="h-4 w-4" /> All users
      </Link>

      {isPending && (
        <div className="mt-6 flex flex-col gap-4" aria-label="Loading member">
          <Skeleton className="h-40 rounded-2xl" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {isAxiosError(error) && error.response?.status === 404 ? "This user doesn't exist or was deleted." : "Could not load this user."}
        </p>
      )}

      {member && (
        <div className="mt-6 flex flex-col gap-4">
          <RiskBanner member={member} />
          <MemberHeader member={member} isSelf={member.id === currentAdminId} onAssignPlan={() => setAssign({ open: true })} onPrintCard={() => setCard(true)} />

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat icon={CalendarCheck} label="Gym visits (30 days)" value={String(member.activity.visits30d)} />
            <Stat icon={Dumbbell} label="Workouts (30 days)" value={String(member.activity.workoutsCompleted30d)} />
            <Stat icon={UtensilsCrossed} label="Meals logged (7 days)" value={String(member.activity.mealsLogged7d)} />
            <Stat icon={UserRound} label="Member for" value={member.memberForDays < 60 ? `${member.memberForDays} days` : `${Math.floor(member.memberForDays / 30)} months`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <MembershipCard member={member} onRenew={() => setPayment({ open: true, planId: member.membership?.plan.id })} />
            <PaymentsCard member={member} onRecord={() => setPayment({ open: true })} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <AttendanceCard member={member} />
            <WeightCard member={member} />
          </div>

          {/* Left: plans, then locker + access side by side; right: PT and profile. */}
          <div className="grid items-start gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4 lg:col-span-2">
              <PlansCard member={member} onChange={(kind) => setAssign({ open: true, kind })} />
              <div className="grid gap-4 md:grid-cols-2">
                <FacilityCard member={member} />
                <AccessCard member={member} isSelf={member.id === currentAdminId} />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <PtCard member={member} />
              <Panel title="Profile" icon={UserRound}>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {[
                    ["Goal", humanize(member.fitnessGoal)],
                    ["Experience", humanize(member.experienceLevel)],
                    ["Activity", humanize(member.activityLevel)],
                    ["Age", member.age ? String(member.age) : "—"],
                    ["Height", member.heightCm ? `${member.heightCm} cm` : "—"],
                    ["Target weight", member.targetWeightKg ? `${member.targetWeightKg} kg` : "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-xs text-muted">{label}</dt>
                      <dd className="truncate">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GamificationCard member={member} />
            <MedicalCard member={member} />
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[1.2fr_1fr]">
            <TimelineCard member={member} />
            <NotesCard member={member} />
          </div>

          <RecordPaymentDialog member={member} open={payment.open} planId={payment.planId} onClose={() => setPayment({ open: false })} />
          <AssignPlanDialog member={member} open={assign.open} kind={assign.kind} onClose={() => setAssign({ open: false })} />
          <MemberCardDialog member={member} open={card} onClose={() => setCard(false)} />
        </div>
      )}
    </div>
  );
}
