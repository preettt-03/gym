"use client";

import { useState } from "react";
import Script from "next/script";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, CheckCircle2, CreditCard, Download, Loader2, Receipt, ShieldCheck } from "lucide-react";
import {
  checkout,
  downloadInvoicePdf,
  getInvoice,
  getMyMembership,
  listMembershipPlans,
  listMyPayments,
  verifyPayment,
  type MembershipPlan,
  type Payment,
} from "@/lib/membership-api";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorNote, MemberHeader, MemberPage, Meter, Panel } from "@/components/member/ui";
import { cn, humanize } from "@/lib/utils";

// Razorpay's checkout.js attaches itself to window.Razorpay — no official
// types package, so declare just the shape we use.
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const TZ = "Asia/Kolkata";
const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const DAY_MS = 24 * 60 * 60 * 1000;

function finalPrice(plan: MembershipPlan) {
  if (!plan.discountPercent) return plan.price;
  return Math.round(plan.price - (plan.price * plan.discountPercent) / 100);
}

type Flow = { state: "idle" } | { state: "opening" } | { state: "verifying" } | { state: "done"; until: string } | { state: "error"; message: string };

const PAYMENT_STATUS: Record<string, string> = {
  COMPLETED: "bg-success/10 text-success",
  PENDING: "bg-[#fab219]/10 text-[#fab219]",
  FAILED: "bg-danger/10 text-danger",
  REFUNDED: "bg-surface-2 text-muted",
};

function InvoiceDetails({ paymentId }: { paymentId: string }) {
  const { data, isPending, isError } = useQuery({ queryKey: ["invoice", paymentId], queryFn: () => getInvoice(paymentId) });
  if (isPending) return <Skeleton className="h-16 rounded-xl" />;
  if (isError || !data) return <p className="text-xs text-danger">Could not load the invoice.</p>;
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface-2 p-4 text-xs sm:grid-cols-4">
      <div>
        <dt className="text-muted">Invoice</dt>
        <dd className="font-medium">{data.invoiceNumber ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-muted">Plan</dt>
        <dd className="font-medium">{data.plan?.name}</dd>
      </div>
      <div>
        <dt className="text-muted">Duration</dt>
        <dd className="font-medium">{data.plan?.durationDays} days</dd>
      </div>
      <div>
        <dt className="text-muted">Amount</dt>
        <dd className="font-medium">
          {inr.format(data.amount)} · {humanize(data.status)}
        </dd>
      </div>
    </dl>
  );
}

function PaymentRow({ payment }: { payment: Payment }) {
  const [open, setOpen] = useState(false);
  const pdf = useMutation({ mutationFn: () => downloadInvoicePdf(payment.id, payment.invoiceNumber) });
  const completed = payment.status === "COMPLETED";
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10">
            <CreditCard className="h-4 w-4 text-gold" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{payment.plan.name}</p>
            <p className="text-xs text-muted">
              {dateTime.format(new Date(payment.createdAt))} · {humanize(payment.gateway)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold tabular-nums">{inr.format(payment.amount)}</span>
          <span className={cn("rounded-full px-2.5 py-1 text-xs", PAYMENT_STATUS[payment.status] ?? "bg-surface-2 text-muted")}>{humanize(payment.status)}</span>
          {completed && (
            <>
              <Button variant="glass" size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                <Receipt className="h-3.5 w-3.5" /> {open ? "Hide" : "Invoice"}
              </Button>
              <Button variant="glass" size="sm" disabled={pdf.isPending} onClick={() => pdf.mutate()}>
                {pdf.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
              </Button>
            </>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-3">
          <InvoiceDetails paymentId={payment.id} />
        </div>
      )}
      {pdf.isError && <p className="mt-2 text-xs text-danger">Could not download the PDF. Please try again.</p>}
    </li>
  );
}

function MembershipContent() {
  const queryClient = useQueryClient();
  const [flow, setFlow] = useState<Flow>({ state: "idle" });
  const [now] = useState(() => Date.now());

  const plans = useQuery({ queryKey: ["membership-plans"], queryFn: listMembershipPlans });
  const membership = useQuery({ queryKey: ["my-membership"], queryFn: getMyMembership });
  const payments = useQuery({ queryKey: ["my-payments"], queryFn: listMyPayments });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["my-membership"] });
    queryClient.invalidateQueries({ queryKey: ["my-payments"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  // The membership is only shown as active once the server has verified the
  // payment signature — never just because the widget reported success.
  const verify = useMutation({
    mutationFn: verifyPayment,
    onMutate: () => setFlow({ state: "verifying" }),
    onSuccess: (result) => {
      refresh();
      setFlow({ state: "done", until: result.membership?.endDate ?? "" });
    },
    onError: () =>
      setFlow({ state: "error", message: "We couldn't verify this payment. If money was deducted, it will be refunded automatically — or contact the gym." }),
  });

  const start = useMutation({
    mutationFn: (planId: string) => checkout(planId, "RAZORPAY"),
    onMutate: () => setFlow({ state: "opening" }),
    onSuccess: (result) => {
      if (!result.requiresPayment) {
        // Demo mode (no Razorpay keys configured) — completed server-side.
        refresh();
        setFlow({ state: "done", until: result.membership?.endDate ?? "" });
        return;
      }
      if (!window.Razorpay) {
        setFlow({ state: "error", message: "The payment window didn't load. Check your connection, refresh and try again." });
        return;
      }
      new window.Razorpay({
        key: result.keyId,
        amount: result.amount,
        currency: result.currency,
        order_id: result.orderId,
        name: "King's Fitness",
        description: "Membership purchase",
        theme: { color: "#e2c46e" },
        handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
          verify.mutate({
            paymentId: result.paymentId!,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }),
        modal: { ondismiss: () => setFlow({ state: "error", message: "Payment cancelled — you haven't been charged." }) },
      }).open();
    },
    onError: () => setFlow({ state: "error", message: "Could not start checkout. Please try again in a moment." }),
  });

  const m = membership.data?.membership;
  const active = membership.data?.isActive && m;
  const totalDays = m ? Math.max(1, (new Date(m.endDate).getTime() - new Date(m.startDate).getTime()) / DAY_MS) : 1;
  const daysLeft = m ? Math.max(0, Math.ceil((new Date(m.endDate).getTime() - now) / DAY_MS)) : 0;
  const busy = flow.state === "opening" || flow.state === "verifying";
  const planList = plans.data ?? [];

  return (
    <MemberPage>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <MemberHeader eyebrow="Account" title="Membership" description="Your plan, renewals and payment history." />

      <div aria-live="polite" className="mt-6 empty:hidden">
        {flow.state === "opening" && (
          <p role="status" className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-gold" /> Opening secure checkout…
          </p>
        )}
        {flow.state === "verifying" && (
          <p role="status" className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-gold" /> Confirming your payment with the bank — don&apos;t close this page.
          </p>
        )}
        {flow.state === "done" && (
          <p role="status" className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> Payment confirmed — your membership is active{flow.until ? ` until ${date.format(new Date(flow.until))}` : ""}.
          </p>
        )}
        {flow.state === "error" && <ErrorNote>{flow.message}</ErrorNote>}
      </div>

      <section className={cn("mt-6 rounded-2xl border p-6", active ? (daysLeft <= 7 ? "border-[#fab219]/40 bg-[#fab219]/5" : "border-gold/40 bg-gold/5") : "border-border bg-surface")}>
        {membership.isPending ? (
          <Skeleton className="h-20 rounded-xl" />
        ) : active ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Current plan</p>
              <h2 className="mt-1 text-2xl font-bold uppercase">{m!.plan.name}</h2>
              <p className="text-sm text-muted">
                {date.format(new Date(m!.startDate))} – {date.format(new Date(m!.endDate))}
              </p>
            </div>
            <div className="sm:w-72">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4 text-gold" /> {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                </span>
                <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs text-success">Active</span>
              </div>
              <div className="mt-2">
                <Meter value={totalDays - daysLeft} max={totalDays} label="Membership time used" />
              </div>
              {daysLeft <= 7 && <p className="mt-2 text-xs text-[#fab219]">Ending soon — renew below so you don&apos;t miss a day.</p>}
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold uppercase">{membership.data?.hasMembership ? "Your plan has ended" : "No active plan"}</h2>
            <p className="mt-1 text-sm text-muted">
              {membership.data?.hasMembership && m ? `Your ${m.plan.name} ended on ${date.format(new Date(m.endDate))}. ` : ""}Pick a plan below to start training.
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="choose-plan" className="mt-10">
        <h2 id="choose-plan" className="mb-4 text-lg font-semibold uppercase">
          {active ? "Renew or switch" : "Choose a plan"}
        </h2>
        {plans.isPending && <Skeleton className="h-64 rounded-2xl" />}
        {plans.isError && <ErrorNote>Could not load plans.</ErrorNote>}
        {plans.data?.length === 0 && <EmptyState title="No plans available right now" description="Please check back soon or ask at the front desk." />}
        <ul className={cn("grid gap-4", planList.length === 1 ? "max-w-sm" : planList.length === 2 ? "max-w-3xl md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3")}>
          {planList.map((plan, i) => {
            const featured = planList.length === 3 && i === 1;
            return (
              <li key={plan.id} className={cn("glass-card relative flex flex-col p-6", featured && "border-gold/70")}>
                {featured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gold px-3 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-accent-foreground">
                    Most popular
                  </span>
                )}
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">{plan.name}</h3>
                <p className="mt-3 flex items-baseline gap-2">
                  <span className="text-4xl font-semibold">{inr.format(finalPrice(plan))}</span>
                  <span className="text-sm text-muted">/ {plan.durationDays} days</span>
                </p>
                {plan.discountPercent ? (
                  <p className="text-sm text-muted">
                    <span className="line-through">{inr.format(plan.price)}</span> <span className="text-gold">Save {plan.discountPercent}%</span>
                  </p>
                ) : null}
                {plan.description && <p className="mt-3 text-sm text-muted">{plan.description}</p>}
                <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm">
                  {plan.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> {b}
                    </li>
                  ))}
                </ul>
                <Button className="mt-6 uppercase tracking-wider" variant={featured ? "default" : "outline"} disabled={busy} onClick={() => start.mutate(plan.id)}>
                  {busy && start.variables === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {active ? "Renew with this plan" : "Buy plan"}
                </Button>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <ShieldCheck className="h-4 w-4 text-gold" /> Payments are processed securely by Razorpay. We never see or store your card details.
        </p>
      </section>

      <div className="mt-10">
        <Panel icon={Receipt} title="Payment history">
          {payments.isPending && <Skeleton className="h-24 rounded-xl" />}
          {payments.data?.length === 0 && <p className="text-sm text-muted">No payments yet.</p>}
          {payments.data && payments.data.length > 0 && (
            <ul className="divide-y divide-border">
              {payments.data.map((p) => (
                <PaymentRow key={p.id} payment={p} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </MemberPage>
  );
}

export default function MembershipPage() {
  return (
    <RequireAuth>
      <MembershipContent />
    </RequireAuth>
  );
}
