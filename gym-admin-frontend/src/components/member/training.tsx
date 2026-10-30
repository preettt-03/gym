import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dumbbell, KeyRound, Loader2, Lock, Nfc, Repeat, Save, ShieldCheck, Unlink, UserCog, UtensilsCrossed } from "lucide-react";
import { assignDietPlan, assignWorkoutPlan, listAdminDietPlans, listAdminWorkoutPlans, listUsers, updateUser, type Role } from "@/lib/api";
import { completePtSession, setFacility, setPtPackage, unassignDietPlan, unassignWorkoutPlan, type MemberDetail } from "@/lib/member-api";
import { fmtDate, useMemberAction } from "@/lib/member-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormAlert } from "@/components/ui/form-message";
import { apiErrorMessage } from "@/hooks/use-toast";
import { Empty, Panel, Pill } from "@/components/member/shared";
import { humanize, ROLE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export function AssignPlanDialog({ member, open, kind: initialKind, onClose }: { member: MemberDetail; open: boolean; kind?: "workout" | "diet"; onClose: () => void }) {
  const [kind, setKind] = useState<"workout" | "diet">(initialKind ?? "workout");
  const [planId, setPlanId] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setKind(initialKind ?? "workout");
      setPlanId("");
      setError(null);
    }
  }, [open, initialKind]);

  const workouts = useQuery({ queryKey: ["admin-workout-plans"], queryFn: listAdminWorkoutPlans, enabled: open });
  const diets = useQuery({ queryKey: ["admin-diet-plans"], queryFn: listAdminDietPlans, enabled: open });
  const current = kind === "workout" ? member.plans.workout : member.plans.diet;

  const assign = useMemberAction(
    member.id,
    async () => {
      // "Change" = assign the new plan, then detach whatever was active before.
      if (kind === "workout") await assignWorkoutPlan(planId, [member.id]);
      else await assignDietPlan(planId, [member.id]);
      await Promise.all(current.filter((p) => p.id !== planId).map((p) => (kind === "workout" ? unassignWorkoutPlan(p.id, member.id) : unassignDietPlan(p.id, member.id))));
    },
    { success: `${kind === "workout" ? "Workout" : "Diet"} plan assigned`, error: "Could not assign the plan", onDone: onClose }
  );

  const options =
    kind === "workout"
      ? workouts.data?.map((p) => ({ value: p.id, label: `${p.title} · ${humanize(p.difficulty)}` }))
      : diets.data?.map((p) => ({ value: p.id, label: `${p.title}${p.estimatedCalories ? ` · ${p.estimatedCalories} kcal` : ""}` }));

  return (
    <Dialog
      open={open}
      onClose={assign.isPending ? () => {} : onClose}
      title="Assign a plan"
      description={current.length ? `Replaces the current ${kind} plan (${current.map((p) => p.title).join(", ")}).` : "The member sees it in their app straight away."}
      footer={
        <>
          <Button variant="glass" onClick={onClose} disabled={assign.isPending}>
            Cancel
          </Button>
          <Button
            disabled={assign.isPending}
            onClick={() => {
              if (!planId) return setError("Pick a plan");
              assign.mutate(undefined, { onError: (err) => setError(apiErrorMessage(err, "Could not assign the plan")) });
            }}
          >
            {assign.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Assign
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-2 p-1">
          {(["workout", "diet"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => (setKind(k), setPlanId(""))}
              className={cn("flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold", kind === k ? "bg-gold text-accent-foreground" : "text-muted hover:text-foreground")}
            >
              {k === "workout" ? <Dumbbell className="h-4 w-4" /> : <UtensilsCrossed className="h-4 w-4" />}
              {k === "workout" ? "Workout plan" : "Diet plan"}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="assign-plan" className="mb-1.5 block text-sm font-medium">
            Plan
          </label>
          <Select id="assign-plan" value={planId} onChange={setPlanId} options={options ?? []} placeholder={options ? (options.length ? "Pick a plan" : "No plans yet — create one first") : "Loading plans…"} />
        </div>
        <FormAlert message={error} />
      </div>
    </Dialog>
  );
}

export function PlansCard({ member, onChange }: { member: MemberDetail; onChange: (kind: "workout" | "diet") => void }) {
  const [detach, setDetach] = useState<null | { kind: "workout" | "diet"; id: string; title: string }>(null);
  const remove = useMemberAction(member.id, () => (detach!.kind === "workout" ? unassignWorkoutPlan(detach!.id, member.id) : unassignDietPlan(detach!.id, member.id)), {
    success: "Plan detached",
    error: "Could not detach the plan",
    onDone: () => setDetach(null),
  });
  const { workout, diet } = member.plans;

  const card = (kind: "workout" | "diet", Icon: typeof Dumbbell, title: string, body: React.ReactNode, id?: string) => (
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-surface-2/50 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        <Icon className="h-3.5 w-3.5 text-gold" /> {kind === "workout" ? "Workout" : "Diet"}
      </p>
      <p className="mt-1.5 truncate font-semibold">{title}</p>
      <div className="mt-1 flex-1 text-xs text-muted">{body}</div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="glass" onClick={() => onChange(kind)}>
          <Repeat className="h-3.5 w-3.5" /> {id ? "Change" : "Assign"}
        </Button>
        {id && (
          <Button size="sm" variant="ghost" className="text-muted hover:text-danger" onClick={() => setDetach({ kind, id, title })}>
            <Unlink className="h-3.5 w-3.5" /> Detach
          </Button>
        )}
      </div>
    </div>
  );

  const w = workout[0];
  const d = diet[0];
  const total = d ? d.macros.protein * 4 + d.macros.carbs * 4 + d.macros.fat * 9 || 1 : 1;

  return (
    <Panel title="Assigned plans" icon={Dumbbell}>
      <div className="grid gap-3 sm:grid-cols-2">
        {w
          ? card("workout", Dumbbell, w.title, <>{w.daysPerWeek} training day{w.daysPerWeek === 1 ? "" : "s"} / week · {humanize(w.difficulty)}{w.estimatedMinutes ? ` · ~${w.estimatedMinutes} min` : ""}<br />Since {fmtDate.format(new Date(w.assignedAt))}</>, w.id)
          : card("workout", Dumbbell, "No workout plan", "Assign one so the member knows what to train.")}
        {d
          ? card(
              "diet",
              UtensilsCrossed,
              d.title,
              <>
                {d.calories} kcal · P {d.macros.protein}g · C {d.macros.carbs}g · F {d.macros.fat}g
                <span className="mt-2 flex h-1.5 overflow-hidden rounded-full" aria-hidden>
                  <span className="bg-gold" style={{ width: `${((d.macros.protein * 4) / total) * 100}%` }} />
                  <span className="bg-gold-dark" style={{ width: `${((d.macros.carbs * 4) / total) * 100}%` }} />
                  <span className="bg-[#8a7a4a]" style={{ width: `${((d.macros.fat * 9) / total) * 100}%` }} />
                </span>
              </>,
              d.id
            )
          : card("diet", UtensilsCrossed, "No diet plan", "Assign one to set calorie and macro targets.")}
      </div>
      {(workout.length > 1 || diet.length > 1) && <p className="mt-3 text-xs text-[#fab219]">More than one active plan — changing will keep just the one you pick.</p>}
      <ConfirmDialog
        open={Boolean(detach)}
        title="Detach this plan?"
        message={`${detach?.title} disappears from the member's app. Their past logs stay.`}
        confirmLabel="Detach"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setDetach(null)}
      />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// PT + locker / RFID
// ---------------------------------------------------------------------------

export function PtCard({ member }: { member: MemberDetail }) {
  const [total, setTotal] = useState(String(member.ptSessionsTotal));
  useEffect(() => setTotal(String(member.ptSessionsTotal)), [member.ptSessionsTotal]);
  const used = member.ptSessionsUsed;
  const left = Math.max(0, member.ptSessionsTotal - used);

  const complete = useMemberAction(member.id, () => completePtSession(member.id), { success: "Session logged — trainer notified", error: "Could not log the session" });
  const save = useMemberAction(member.id, (n: number) => setPtPackage(member.id, n), { success: "PT package updated", error: "Could not update the package" });

  return (
    <Panel title="Personal training" icon={UserCog}>
      {member.ptSessionsTotal > 0 ? (
        <>
          <p className="text-sm">
            <span className="font-display text-3xl font-bold text-gold">{used}</span>
            <span className="text-muted"> of {member.ptSessionsTotal} sessions used</span>
          </p>
          <div className="mt-2 flex gap-1" role="meter" aria-label="PT sessions used" aria-valuenow={used} aria-valuemin={0} aria-valuemax={member.ptSessionsTotal}>
            {Array.from({ length: Math.min(member.ptSessionsTotal, 40) }, (_, i) => (
              <span key={i} className={cn("h-2 flex-1 rounded-full", i < used ? "bg-gold" : "bg-surface-2")} />
            ))}
          </div>
          <Button className="mt-4 w-full" disabled={left === 0 || complete.isPending} onClick={() => complete.mutate()}>
            {complete.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {left === 0 ? "Package used up" : `Mark 1 session completed (${left} left)`}
          </Button>
          {member.trainer ? (
            <p className="mt-2 text-xs text-muted">Notifies {member.trainer.name ?? member.trainer.email}.</p>
          ) : (
            <p className="mt-2 text-xs text-[#fab219]">No trainer assigned — the session is logged without one.</p>
          )}
          {member.ptRecent.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted">
              {member.ptRecent.slice(0, 3).map((s) => (
                <li key={s.id}>
                  {fmtDate.format(new Date(s.completedAt))}
                  {s.trainer && ` · ${s.trainer.name ?? s.trainer.email}`}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <Empty>No PT package yet. Set the number of sessions bought below.</Empty>
      )}
      <form
        className="mt-4 flex items-end gap-2 border-t border-border pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(total);
          if (Number.isInteger(n) && n >= 0) save.mutate(n);
        }}
      >
        <div className="flex-1">
          <label htmlFor="pt-total" className="mb-1.5 block text-xs font-medium text-muted">
            Sessions in package
          </label>
          <Input id="pt-total" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} className="h-10" />
        </div>
        <Button type="submit" variant="glass" className="h-10" disabled={save.isPending || total === String(member.ptSessionsTotal)}>
          <Save className="h-4 w-4" /> Save
        </Button>
      </form>
    </Panel>
  );
}

export function FacilityCard({ member }: { member: MemberDetail }) {
  const [locker, setLocker] = useState(member.lockerNumber ?? "");
  const [rfid, setRfid] = useState(member.rfidTagId ?? "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setLocker(member.lockerNumber ?? "");
    setRfid(member.rfidTagId ?? "");
  }, [member.lockerNumber, member.rfidTagId]);

  const save = useMemberAction(member.id, (v: { lockerNumber?: string | null; rfidTagId?: string | null }) => setFacility(member.id, v), {
    success: "Saved",
    error: "Could not save",
    onDone: () => setError(null),
  });
  const run = (v: { lockerNumber?: string | null; rfidTagId?: string | null }) => save.mutate(v, { onError: (err) => setError(apiErrorMessage(err, "Could not save")) });

  const row = (id: string, Icon: typeof Lock, label: string, value: string, set: (v: string) => void, current: string | null, key: "lockerNumber" | "rfidTagId", placeholder: string) => (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
        <Icon className="h-3.5 w-3.5 text-gold" /> {label}
        {current && <Pill tone="gold" className="ml-auto py-0">{current}</Pill>}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          className="h-10"
          onChange={(e) => set(e.target.value)}
          onKeyDown={(e) => {
            // Most USB RFID readers "type" the tag and press Enter.
            if (e.key === "Enter") {
              e.preventDefault();
              run({ [key]: value.trim() || null });
            }
          }}
        />
        <Button variant="glass" className="h-10" disabled={save.isPending || value.trim() === (current ?? "")} onClick={() => run({ [key]: value.trim() || null })}>
          {current && !value.trim() ? "Release" : "Save"}
        </Button>
      </div>
    </div>
  );

  return (
    <Panel title="Locker & RFID" icon={KeyRound}>
      <div className="flex flex-col gap-4">
        {row("locker", Lock, "Locker", locker, setLocker, member.lockerNumber, "lockerNumber", "e.g. A-12")}
        {row("rfid", Nfc, "RFID key fob", rfid, setRfid, member.rfidTagId, "rfidTagId", "Tap the fob on the reader…")}
        <FormAlert message={error} />
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Role & trainer
// ---------------------------------------------------------------------------

export function AccessCard({ member, isSelf }: { member: MemberDetail; isSelf: boolean }) {
  const [role, setRole] = useState<Role>(member.role);
  const [trainerId, setTrainerId] = useState(member.trainerId ?? "");
  const [confirmRole, setConfirmRole] = useState(false);
  useEffect(() => {
    setRole(member.role);
    setTrainerId(member.trainerId ?? "");
  }, [member.role, member.trainerId]);

  const trainers = useQuery({ queryKey: ["admin-users", "trainers"], queryFn: () => listUsers({ role: "TRAINER", accountStatus: "ACTIVE", limit: 100 }), enabled: member.role === "USER" });
  const update = useMemberAction(member.id, (patch: Parameters<typeof updateUser>[1]) => updateUser(member.id, patch), {
    success: (_d, p) => (p.role ? `Role changed to ${ROLE_LABEL[p.role]}` : "Trainer updated"),
    error: "Could not update",
    onDone: () => setConfirmRole(false),
  });

  return (
    <Panel title="Access & coaching" icon={ShieldCheck}>
      {isSelf ? (
        <Empty>This is your account. Role and status can only be changed by another admin.</Empty>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="user-role" className="mb-1.5 block text-xs font-medium text-muted">
              Role
            </label>
            <div className="flex gap-2">
              <Select id="user-role" value={role} onChange={(v) => setRole(v as Role)} options={(["USER", "TRAINER", "ADMIN"] as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
              <Button variant="glass" disabled={role === member.role} onClick={() => setConfirmRole(true)}>
                Save
              </Button>
            </div>
            {member.role === "TRAINER" && member.traineeCount > 0 && (
              <p className="mt-1.5 text-xs text-muted">
                Coaches {member.traineeCount} member{member.traineeCount === 1 ? "" : "s"} — reassign them before changing this role.
              </p>
            )}
          </div>
          {member.role === "USER" && (
            <div>
              <label htmlFor="user-trainer" className="mb-1.5 block text-xs font-medium text-muted">
                Trainer
              </label>
              <div className="flex gap-2">
                <Select
                  id="user-trainer"
                  value={trainerId}
                  disabled={trainers.isPending}
                  onChange={setTrainerId}
                  placeholder={trainers.isPending ? "Loading trainers..." : "No trainer"}
                  options={[
                    { value: "", label: "No trainer" },
                    ...(member.trainer && !trainers.data?.items.some((t) => t.id === member.trainer!.id) ? [{ value: member.trainer.id, label: member.trainer.name ?? member.trainer.email }] : []),
                    ...(trainers.data?.items.map((t) => ({ value: t.id, label: t.name ?? t.email })) ?? []),
                  ]}
                />
                <Button variant="glass" disabled={trainerId === (member.trainerId ?? "") || update.isPending} onClick={() => update.mutate({ trainerId: trainerId || null })}>
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmRole}
        title={`Make ${member.name ?? member.email} ${role === "ADMIN" ? "an admin" : `a ${ROLE_LABEL[role].toLowerCase()}`}?`}
        message={role === "ADMIN" ? "Admins get full access to every member's data and all settings. They'll be signed out and need to log in again." : "Their access changes immediately and they'll be signed out on every device."}
        confirmLabel="Change role"
        pending={update.isPending}
        onCancel={() => {
          setConfirmRole(false);
          setRole(member.role);
        }}
        onConfirm={() => update.mutate({ role })}
      />
    </Panel>
  );
}
