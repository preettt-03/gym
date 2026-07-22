import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, ClipboardList, CreditCard, Dumbbell, UtensilsCrossed, Users } from "lucide-react";
import { getAdminDashboard } from "@/lib/api";
import { Card } from "@/components/ui/card";

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm text-muted">
        {icon} {label}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </Card>
  );
}

export function DashboardPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["admin-dashboard"], queryFn: getAdminDashboard });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-muted">Platform overview.</p>

      {isLoading && <p className="mt-8 text-muted">Loading...</p>}
      {isError && <p className="mt-8 text-danger">Could not load dashboard.</p>}

      {data && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Users className="h-4 w-4" />} label="Total users" value={String(data.totalUsers)} />
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="New (7 days)"
            value={String(data.newUsersLast7Days)}
          />
          <StatCard
            icon={<CreditCard className="h-4 w-4" />}
            label="Active memberships"
            value={String(data.activeMemberships)}
          />
          <StatCard
            icon={<CalendarCheck className="h-4 w-4" />}
            label="Attendance today"
            value={String(data.attendanceToday)}
          />
          <StatCard icon={<Dumbbell className="h-4 w-4" />} label="Exercises" value={String(data.totalExercises)} />
          <StatCard
            icon={<ClipboardList className="h-4 w-4" />}
            label="Workout plans"
            value={String(data.totalWorkoutPlans)}
          />
          <StatCard
            icon={<UtensilsCrossed className="h-4 w-4" />}
            label="Diet plans"
            value={String(data.totalDietPlans)}
          />
          <StatCard
            icon={<CreditCard className="h-4 w-4" />}
            label="Total revenue"
            value={`₹${data.totalRevenue}`}
          />
        </div>
      )}
    </div>
  );
}
