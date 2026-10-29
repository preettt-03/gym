import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  ArrowLeft,
  CalendarCheck,
  Dumbbell,
  KeyRound,
  Scale,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import {
  deleteUser,
  getUserDetail,
  listUsers,
  sendPasswordReset,
  updateUser,
  type AccountStatus,
  type AdminUserDetail,
  type Role,
} from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Avatar, RoleBadge, StatusBadge } from "@/components/user-badges";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiErrorMessage, useToast } from "@/hooks/use-toast";
import { humanize, ROLE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const selectClass =
  "glass-input h-11 w-full px-3 text-sm outline-none focus:border-gold/60 focus:ring-2 focus:ring-gold/25 disabled:opacity-60";

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("glass-card min-w-0 p-5", className)}>
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

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

type Pending =
  | { kind: "role"; role: Role }
  | { kind: "status"; status: AccountStatus }
  | { kind: "reset" }
  | { kind: "delete" };

function AccessCard({ user, isSelf }: { user: AdminUserDetail; isSelf: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>(user.role);
  const [trainerId, setTrainerId] = useState(user.trainerId ?? "");
  const [pending, setPending] = useState<Pending | null>(null);

  const trainers = useQuery({
    queryKey: ["admin-users", "trainers"],
    queryFn: () => listUsers({ role: "TRAINER", accountStatus: "ACTIVE", limit: 100 }),
    enabled: user.role === "USER",
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-user", user.id] });
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };
  const fail = (fallback: string) => (err: unknown) => {
    toast.show(apiErrorMessage(err, fallback), "error");
    setPending(null);
  };

  const update = useMutation({
    mutationFn: (patch: Parameters<typeof updateUser>[1]) => updateUser(user.id, patch),
    onSuccess: (_d, patch) => {
      refresh();
      toast.show(
        patch.role ? `Role changed to ${ROLE_LABEL[patch.role]}` : patch.accountStatus ? `Account ${humanize(patch.accountStatus).toLowerCase()}` : "Trainer updated"
      );
      setPending(null);
    },
    onError: (err) => {
      fail("Could not update the account")(err);
      setRole(user.role);
    },
  });
  const reset = useMutation({
    mutationFn: () => sendPasswordReset(user.id),
    onSuccess: (r) => {
      toast.show(`Reset email sent to ${r.email}`);
      setPending(null);
    },
    onError: fail("Could not send the reset email"),
  });
  const remove = useMutation({
    mutationFn: () => deleteUser(user.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.show(`Deleted ${user.email}`);
      navigate("/users");
    },
    onError: fail("Could not delete the user"),
  });

  return (
    <Section title="Access & coaching">
      {isSelf ? (
        <Empty>This is your account. Role, status and deletion can only be changed by another admin.</Empty>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <label htmlFor="user-role" className="mb-1.5 block text-sm font-medium">
              Role
            </label>
            <div className="flex gap-2">
              <select id="user-role" className={selectClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {(["USER", "TRAINER", "ADMIN"] as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <Button variant="glass" disabled={role === user.role} onClick={() => setPending({ kind: "role", role })}>
                Save
              </Button>
            </div>
            {user.role === "TRAINER" && user.traineeCount > 0 && (
              <p className="mt-1.5 text-xs text-muted">
                Coaches {user.traineeCount} member{user.traineeCount === 1 ? "" : "s"} — reassign them before changing this role.
              </p>
            )}
          </div>

          {user.role === "USER" && (
            <div>
              <label htmlFor="user-trainer" className="mb-1.5 block text-sm font-medium">
                Trainer
              </label>
              <div className="flex gap-2">
                <select
                  id="user-trainer"
                  className={selectClass}
                  value={trainerId}
                  disabled={trainers.isPending}
                  onChange={(e) => setTrainerId(e.target.value)}
                >
                  <option value="">No trainer</option>
                  {/* Keep the current trainer selectable even if they're no longer active. */}
                  {user.trainer && !trainers.data?.items.some((t) => t.id === user.trainer!.id) && (
                    <option value={user.trainer.id}>{user.trainer.name ?? user.trainer.email}</option>
                  )}
                  {trainers.data?.items.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name ?? t.email}
                    </option>
                  ))}
                </select>
                <Button
                  variant="glass"
                  disabled={trainerId === (user.trainerId ?? "") || update.isPending}
                  onClick={() => update.mutate({ trainerId: trainerId || null })}
                >
                  Save
                </Button>
              </div>
              {trainers.data && trainers.data.items.length === 0 && (
                <p className="mt-1.5 text-xs text-muted">No active trainers yet — change a staff member&apos;s role to Trainer first.</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {user.accountStatus === "ACTIVE" ? (
              <Button variant="glass" size="sm" onClick={() => setPending({ kind: "status", status: "SUSPENDED" })}>
                Suspend
              </Button>
            ) : (
              <Button variant="glass" size="sm" disabled={update.isPending} onClick={() => update.mutate({ accountStatus: "ACTIVE" })}>
                Reactivate
              </Button>
            )}
            {user.signInMethod === "PASSWORD" && (
              <Button variant="glass" size="sm" onClick={() => setPending({ kind: "reset" })}>
                <KeyRound className="h-4 w-4" /> Send reset email
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10" onClick={() => setPending({ kind: "delete" })}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pending?.kind === "role"}
        title={`Make ${user.name ?? user.email} ${pending?.kind === "role" ? `a${pending.role === "ADMIN" ? "n" : ""} ${ROLE_LABEL[pending.role].toLowerCase()}` : ""}?`}
        message={
          pending?.kind === "role" && pending.role === "ADMIN"
            ? "Admins get full access to every member's data and all settings. They'll be signed out and need to log in again."
            : "Their access changes immediately and they'll be signed out on every device."
        }
        confirmLabel="Change role"
        pending={update.isPending}
        onCancel={() => {
          setPending(null);
          setRole(user.role);
        }}
        onConfirm={() => pending?.kind === "role" && update.mutate({ role: pending.role })}
      />
      <ConfirmDialog
        open={pending?.kind === "status"}
        title="Suspend this account?"
        message="They'll be signed out and won't be able to log in until you reactivate the account."
        confirmLabel="Suspend"
        destructive
        pending={update.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => update.mutate({ accountStatus: "SUSPENDED" })}
      />
      <ConfirmDialog
        open={pending?.kind === "reset"}
        title="Send a password reset email?"
        message={`${user.email} will get a code to choose a new password and will be signed out on every device. You won't see or set their password.`}
        confirmLabel="Send reset email"
        pending={reset.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => reset.mutate()}
      />
      <ConfirmDialog
        open={pending?.kind === "delete"}
        title="Delete this user?"
        message={`${user.email} will be removed and signed out everywhere. This can't be undone from the admin panel.`}
        confirmLabel="Delete user"
        destructive
        pending={remove.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => remove.mutate()}
      />
    </Section>
  );
}

export function UserDetailPage() {
  const { id = "" } = useParams();
  const currentAdminId = useAuthStore((s) => s.user?.id);
  const { data: user, isPending, error } = useQuery({
    queryKey: ["admin-user", id],
    queryFn: () => getUserDetail(id),
    retry: (count, err) => !(isAxiosError(err) && err.response?.status === 404) && count < 1,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/users" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold">
        <ArrowLeft className="h-4 w-4" /> All users
      </Link>

      {isPending && (
        <div className="mt-6 flex flex-col gap-4" aria-label="Loading user">
          <Skeleton className="h-24 rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {isAxiosError(error) && error.response?.status === 404 ? "This user doesn't exist or was deleted." : "Could not load this user."}
        </p>
      )}

      {user && (
        <div className="mt-6 flex flex-col gap-4">
          <header className="glass-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <Avatar name={user.name} email={user.email} photoUrl={user.photoUrl} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold uppercase">{user.name ?? user.email}</h1>
              <p className="truncate text-sm text-muted">{user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <RoleBadge role={user.role} />
                <StatusBadge status={user.accountStatus} />
                <span className="rounded-full border border-border px-2.5 py-1 text-muted">
                  {user.isEmailVerified ? "Email verified" : "Email not verified"}
                </span>
                <span className="rounded-full border border-border px-2.5 py-1 text-muted">
                  {user.signInMethod === "GOOGLE" ? "Google sign-in" : "Password sign-in"}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted sm:text-right">
              Joined {date.format(new Date(user.createdAt))}
              {user.trainer && (
                <>
                  <br />
                  Trainer: {user.trainer.name ?? user.trainer.email}
                </>
              )}
            </p>
          </header>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat icon={Dumbbell} label="Workouts (30 days)" value={String(user.activity.workoutsCompleted30d)} />
            <Stat icon={CalendarCheck} label="Gym visits (30 days)" value={String(user.activity.visits30d)} />
            <Stat icon={UtensilsCrossed} label="Meals logged (7 days)" value={String(user.activity.mealsLogged7d)} />
            <Stat
              icon={user.latestWeight ? Scale : Sparkles}
              label={user.latestWeight ? `Weight · ${date.format(new Date(user.latestWeight.loggedAt))}` : "XP"}
              value={user.latestWeight ? `${user.latestWeight.weightKg} kg` : String(user.xp)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <AccessCard key={`${user.role}-${user.trainerId}-${user.accountStatus}`} user={user} isSelf={user.id === currentAdminId} />

            <Section title="Profile">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {[
                  ["Goal", humanize(user.fitnessGoal)],
                  ["Experience", humanize(user.experienceLevel)],
                  ["Activity level", humanize(user.activityLevel)],
                  ["Age", user.age ? String(user.age) : "—"],
                  ["Height", user.heightCm ? `${user.heightCm} cm` : "—"],
                  ["Weight → target", user.weightKg ? `${user.weightKg} → ${user.targetWeightKg ?? "—"} kg` : "—"],
                  ["XP / coins", `${user.xp} / ${user.coins}`],
                  ["Home gym", user.gymName ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs text-muted">{label}</dt>
                    <dd className="truncate">{value}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Memberships">
              {user.memberships.length === 0 ? (
                <Empty>No memberships yet.</Empty>
              ) : (
                <ul className="divide-y divide-border">
                  {user.memberships.map((m) => {
                    const expired = new Date(m.endDate) < new Date();
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-sm">
                        <div>
                          <div className="font-medium">{m.plan.name}</div>
                          <div className="text-xs text-muted">
                            {date.format(new Date(m.startDate))} – {date.format(new Date(m.endDate))}
                          </div>
                        </div>
                        <span className="text-xs text-muted">{m.status === "ACTIVE" && expired ? "Expired" : humanize(m.status)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
            <Section title="Payments">
              {user.payments.length === 0 ? (
                <Empty>No payments yet.</Empty>
              ) : (
                <ul className="divide-y divide-border">
                  {user.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.plan.name}</div>
                        <div className="truncate text-xs text-muted">
                          {dateTime.format(new Date(p.createdAt))} · {humanize(p.gateway)}
                          {p.invoiceNumber && ` · ${p.invoiceNumber}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold tabular-nums">{inr.format(p.amount)}</div>
                        <div className={cn("text-xs", p.status === "COMPLETED" ? "text-success" : p.status === "FAILED" ? "text-danger" : "text-muted")}>
                          {humanize(p.status)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="Recent visits">
              {user.attendances.length === 0 ? (
                <Empty>No gym visits recorded.</Empty>
              ) : (
                <ul className="divide-y divide-border">
                  {user.attendances.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-sm">
                      <span>{dateTime.format(new Date(a.checkInAt))}</span>
                      <span className="text-xs text-muted">
                        {a.durationMinutes ? `${a.durationMinutes} min` : a.checkOutAt ? "Checked out" : "In gym"} · {humanize(a.method)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="Assigned plans">
              {user.workoutPlanAssignments.length + user.dietPlanAssignments.length === 0 ? (
                <Empty>No active workout or diet plans assigned.</Empty>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {user.workoutPlanAssignments.map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <Dumbbell className="h-4 w-4 shrink-0 text-gold" />
                      <span className="flex-1 truncate">{a.plan.title}</span>
                      <span className="text-xs text-muted">since {date.format(new Date(a.assignedAt))}</span>
                    </li>
                  ))}
                  {user.dietPlanAssignments.map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <UtensilsCrossed className="h-4 w-4 shrink-0 text-gold" />
                      <span className="flex-1 truncate">{a.dietPlan.title}</span>
                      <span className="text-xs text-muted">since {date.format(new Date(a.assignedAt))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
