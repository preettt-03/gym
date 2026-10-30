import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Ban, CalendarPlus, CreditCard, Download, Loader2, Pause, Play, Plus, Receipt, RefreshCw, Snowflake } from "lucide-react";
import { listAdminMembershipPlans } from "@/lib/api";
import {
  cancelMembership,
  downloadInvoice,
  extendMembership,
  freezeMembership,
  listMemberPayments,
  recordPayment,
  unfreezeMembership,
  type DeskMethod,
  type MemberDetail,
  type MemberPayment,
} from "@/lib/member-api";
import { fmtDate, fmtDateTime, inr, istDateInput, METHOD_LABEL, useMemberAction } from "@/lib/member-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { FormAlert } from "@/components/ui/form-message";
import { Pagination } from "@/components/ui/page";
import { apiErrorMessage, useToast } from "@/hooks/use-toast";
import { Empty, Panel, Pill, ReasonDialog } from "@/components/member/shared";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

const METHODS: { value: DeskMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "RAZORPAY", label: "Razorpay" },
];

const STATUS_TONE = { ACTIVE: "success", FROZEN: "gold", EXPIRED: "danger", CANCELLED: "muted" } as const;

const finalPrice = (p: { price: number; discountPercent: number | null }) => +(p.price * (1 - (p.discountPercent ?? 0) / 100)).toFixed(2);

// ---------------------------------------------------------------------------

export function RecordPaymentDialog({ member, open, planId, onClose }: { member: MemberDetail; open: boolean; planId?: string; onClose: () => void }) {
  const plans = useQuery({ queryKey: ["admin-membership-plans"], queryFn: listAdminMembershipPlans, enabled: open });
  const active = plans.data?.filter((p) => p.isActive) ?? [];
  const [plan, setPlan] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<DeskMethod>("CASH");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMethod("CASH");
    setReference("");
    setNote("");
    setError(null);
    setPlan(planId ?? member.membership?.plan.id ?? "");
  }, [open, planId, member.membership?.plan.id]);

  // Default the amount to the plan's price whenever the plan changes.
  const chosen = active.find((p) => p.id === plan);
  useEffect(() => {
    if (chosen) setAmount(String(finalPrice(chosen)));
  }, [chosen]);

  const save = useMemberAction(member.id, () => recordPayment(member.id, { planId: plan, amount: Number(amount), method, reference: reference.trim() || null, note: note.trim() || null }), {
    success: "Payment recorded and membership updated",
    error: "Could not record the payment",
    onDone: onClose,
  });

  const renewing = member.membership?.status === "ACTIVE";
  const submit = () => {
    setError(null);
    if (!chosen) return setError("Pick a plan");
    const n = Number(amount);
    if (!amount.trim() || !Number.isFinite(n) || n < 0) return setError("Enter the amount received");
    if (method === "UPI" && !reference.trim()) return setError("Add the UPI reference (UTR) so it can be matched later");
    save.mutate(undefined, { onError: (err) => setError(apiErrorMessage(err, "Could not record the payment")) });
  };

  return (
    <Dialog
      open={open}
      onClose={save.isPending ? () => {} : onClose}
      size="lg"
      title="Record a payment"
      description="For payments taken at the desk. The membership starts or renews as soon as you save."
      footer={
        <>
          <Button variant="glass" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Record {amount && Number.isFinite(Number(amount)) ? inr.format(Number(amount)) : "payment"}
          </Button>
        </>
      }
    >
      <form
        id="payment-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div>
          <label htmlFor="pay-plan" className="mb-1.5 block text-sm font-medium">
            Plan
          </label>
          <Select
            id="pay-plan"
            value={plan}
            onChange={setPlan}
            placeholder={plans.isPending ? "Loading plans…" : "Pick a plan"}
            options={active.map((p) => ({ value: p.id, label: `${p.name} · ${p.durationDays} days · ${inr.format(finalPrice(p))}` }))}
          />
          {chosen && (
            <p className="mt-1.5 text-xs text-muted">
              {renewing
                ? `Adds ${chosen.durationDays} days after the current end date (${fmtDate.format(new Date(member.membership!.endDate))}).`
                : `Starts today and runs ${chosen.durationDays} days.`}
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pay-amount" className="mb-1.5 block text-sm font-medium">
              Amount received (₹)
            </label>
            <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Method</legend>
            <div className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-surface-2 p-1">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={method === m.value}
                  onClick={() => setMethod(m.value)}
                  className={cn("rounded-lg py-1.5 text-xs font-semibold", method === m.value ? "bg-gold text-accent-foreground" : "text-muted hover:text-foreground")}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pay-ref" className="mb-1.5 block text-sm font-medium">
              Reference / UTR {method !== "UPI" && <span className="font-normal text-muted">(optional)</span>}
            </label>
            <Input id="pay-ref" value={reference} maxLength={60} placeholder={method === "UPI" ? "12-digit UTR" : "Receipt / slip no."} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pay-note" className="mb-1.5 block text-sm font-medium">
              Note <span className="font-normal text-muted">(optional)</span>
            </label>
            <Input id="pay-note" value={note} maxLength={200} placeholder="e.g. Diwali offer" onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <FormAlert message={error} />
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

export function MembershipCard({ member, onRenew }: { member: MemberDetail; onRenew: () => void }) {
  const m = member.membership;
  const [dialog, setDialog] = useState<null | { kind: "extend"; days: number } | { kind: "freeze" } | { kind: "cancel" }>(null);
  const [resumeAt, setResumeAt] = useState(istDateInput(14));
  const close = { onDone: () => setDialog(null) };

  const extend = useMemberAction(member.id, (days: number) => extendMembership(member.id, days), { success: (_d, days) => `Extended by ${days} days`, error: "Could not extend", ...close });
  const freeze = useMemberAction(member.id, (reason: string) => freezeMembership(member.id, new Date(`${resumeAt}T00:00:00+05:30`).toISOString(), reason), {
    success: "Membership frozen",
    error: "Could not freeze",
    ...close,
  });
  const resume = useMemberAction(member.id, () => unfreezeMembership(member.id), { success: "Membership resumed", error: "Could not resume" });
  const cancel = useMemberAction(member.id, (reason: string) => cancelMembership(member.id, reason), { success: "Membership cancelled", error: "Could not cancel", ...close });

  if (!m) {
    return (
      <Panel title="Membership" icon={CreditCard}>
        <Empty>No membership yet.</Empty>
        <Button className="mt-4" onClick={onRenew}>
          <Plus className="h-4 w-4" /> Start a membership
        </Button>
      </Panel>
    );
  }

  const usedPct = m.status === "ACTIVE" || m.status === "FROZEN" ? Math.min(100, Math.max(0, ((m.totalDays - m.daysRemaining) / m.totalDays) * 100)) : 100;
  const live = m.status === "ACTIVE" || m.status === "FROZEN";

  return (
    <Panel title="Membership" icon={CreditCard} action={<Pill tone={STATUS_TONE[m.status]}>{humanize(m.status)}</Pill>}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-bold uppercase">{m.plan.name}</p>
          <p className="text-xs text-muted">
            {fmtDate.format(new Date(m.startDate))} – {fmtDate.format(new Date(m.endDate))}
          </p>
        </div>
        {live && (
          <p className="text-right">
            <span className={cn("font-display text-3xl font-bold", m.daysRemaining <= 7 ? "text-[#fab219]" : "text-gold")}>{m.daysRemaining}</span>
            <span className="block text-xs text-muted">days left</span>
          </p>
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Membership used" aria-valuenow={Math.round(usedPct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full", m.status === "FROZEN" ? "bg-gold/40" : "bg-gold")} style={{ width: `${usedPct}%` }} />
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {live && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <CalendarPlus className="h-3.5 w-3.5" /> Extend
            </span>
            {[7, 15, 30].map((d) => (
              <Button key={d} size="sm" variant="glass" onClick={() => setDialog({ kind: "extend", days: d })}>
                +{d} days
              </Button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Button size="sm" onClick={onRenew}>
            <RefreshCw className="h-4 w-4" /> {live ? "Renew / change plan" : "Renew"}
          </Button>
          {m.status === "ACTIVE" && (
            <Button size="sm" variant="glass" onClick={() => setDialog({ kind: "freeze" })}>
              <Snowflake className="h-4 w-4" /> Freeze
            </Button>
          )}
          {m.status === "FROZEN" && (
            <Button size="sm" variant="glass" disabled={resume.isPending} onClick={() => resume.mutate()}>
              <Play className="h-4 w-4" /> Resume now
            </Button>
          )}
          {live && (
            <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10" onClick={() => setDialog({ kind: "cancel" })}>
              <Ban className="h-4 w-4" /> Cancel
            </Button>
          )}
        </div>
      </div>

      <ReasonDialog
        open={dialog?.kind === "extend"}
        title={`Extend by ${dialog?.kind === "extend" ? dialog.days : 0} days?`}
        message={`New end date: ${fmtDate.format(new Date(new Date(m.endDate).getTime() + (dialog?.kind === "extend" ? dialog.days : 0) * 86_400_000))}.`}
        confirmLabel="Extend"
        required={false}
        destructive={false}
        pending={extend.isPending}
        onConfirm={() => dialog?.kind === "extend" && extend.mutate(dialog.days)}
        onCancel={() => setDialog(null)}
      />
      <ReasonDialog
        open={dialog?.kind === "freeze"}
        title="Freeze this membership?"
        message="Check-ins pause until the resume date, and the days left are added back when it resumes."
        confirmLabel="Freeze"
        required={false}
        destructive={false}
        pending={freeze.isPending}
        onConfirm={(reason) => freeze.mutate(reason)}
        onCancel={() => setDialog(null)}
      >
        <div>
          <label htmlFor="resume-at" className="mb-1.5 flex items-center gap-1.5 font-medium">
            <Pause className="h-3.5 w-3.5 text-gold" /> Resume on
          </label>
          <Input id="resume-at" type="date" min={istDateInput(1)} max={istDateInput(180)} value={resumeAt} onChange={(e) => setResumeAt(e.target.value)} />
        </div>
      </ReasonDialog>
      <ReasonDialog
        open={dialog?.kind === "cancel"}
        title="Cancel this membership?"
        message="The member loses gym access right away. Refunds, if any, are handled separately."
        confirmLabel="Cancel membership"
        pending={cancel.isPending}
        onConfirm={(reason) => cancel.mutate(reason)}
        onCancel={() => setDialog(null)}
      />
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function PaymentRow({ memberId, p }: { memberId: string; p: MemberPayment }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2 truncate font-medium">
          {p.plan.name}
          {p.desk && <Pill className="py-0 text-[10px]">Desk</Pill>}
        </div>
        <div className="truncate text-xs text-muted">
          {fmtDateTime.format(new Date(p.createdAt))} · {METHOD_LABEL[p.gateway] ?? humanize(p.gateway)}
          {p.reference && ` · ${p.reference}`}
          {p.note && ` · ${p.note}`}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right">
          <div className="font-semibold tabular-nums">{inr.format(p.amount)}</div>
          <div className={cn("text-xs", p.status === "COMPLETED" ? "text-success" : p.status === "FAILED" ? "text-danger" : "text-muted")}>{humanize(p.status)}</div>
        </div>
        {p.status === "COMPLETED" && (
          <button
            type="button"
            disabled={busy}
            aria-label={`Download invoice ${p.invoiceNumber ?? ""}`}
            onClick={async () => {
              setBusy(true);
              try {
                await downloadInvoice(memberId, p.id, p.invoiceNumber);
              } catch (err) {
                toast.show(apiErrorMessage(err, "Could not download the invoice"), "error");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-lg p-2 text-muted hover:bg-gold/10 hover:text-gold disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </button>
        )}
      </div>
    </li>
  );
}

export function PaymentsCard({ member, onRecord }: { member: MemberDetail; onRecord: () => void }) {
  const [allOpen, setAllOpen] = useState(false);
  const [page, setPage] = useState(1);
  const recent = useQuery({ queryKey: ["member-payments", member.id, "recent"], queryFn: () => listMemberPayments(member.id, 1, 5) });
  const all = useQuery({ queryKey: ["member-payments", member.id, page], queryFn: () => listMemberPayments(member.id, page, 10), enabled: allOpen, placeholderData: keepPreviousData });
  const total = recent.data?.pagination.total ?? 0;

  return (
    <Panel
      title="Payments"
      icon={Receipt}
      action={
        <Button size="sm" onClick={onRecord}>
          <Plus className="h-4 w-4" /> Record payment
        </Button>
      }
    >
      {recent.isPending && <Loader2 className="h-5 w-5 animate-spin text-gold" />}
      {recent.data && recent.data.items.length === 0 && <Empty>No payments yet.</Empty>}
      {recent.data && recent.data.items.length > 0 && (
        <>
          <ul className="divide-y divide-border">
            {recent.data.items.map((p) => (
              <PaymentRow key={p.id} memberId={member.id} p={p} />
            ))}
          </ul>
          {total > 5 && (
            <button type="button" onClick={() => setAllOpen(true)} className="mt-3 text-sm font-semibold text-gold hover:underline">
              View all {total} payments
            </button>
          )}
        </>
      )}
      <Dialog open={allOpen} onClose={() => setAllOpen(false)} size="lg" title="All payments" description={`${total} payment${total === 1 ? "" : "s"} from ${member.name ?? member.email}`}>
        {all.data && (
          <>
            <ul className="divide-y divide-border">
              {all.data.items.map((p) => (
                <PaymentRow key={p.id} memberId={member.id} p={p} />
              ))}
            </ul>
            <Pagination page={all.data.pagination.page} totalPages={all.data.pagination.totalPages} total={all.data.pagination.total} onPageChange={setPage} />
          </>
        )}
      </Dialog>
    </Panel>
  );
}
