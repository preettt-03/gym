"use client";

import { useState } from "react";
import Script from "next/script";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, CreditCard, Download, Receipt } from "lucide-react";
import { format } from "date-fns";
import {
  checkout,
  downloadInvoicePdf,
  getInvoice,
  getMyMembership,
  listMembershipPlans,
  listMyPayments,
  verifyPayment,
  type MembershipPlan,
} from "@/lib/membership-api";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/require-auth";
import { cn } from "@/lib/utils";

// Razorpay's checkout.js attaches itself to window.Razorpay — no official
// types package, so declare just the shape we use.
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function finalPrice(plan: MembershipPlan) {
  if (!plan.discountPercent) return plan.price;
  return Math.round(plan.price - (plan.price * plan.discountPercent) / 100);
}

function PlanCard({ plan, onBuy, isPending }: { plan: MembershipPlan; onBuy: () => void; isPending: boolean }) {
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{plan.name}</CardTitle>
      {plan.description && <CardDescription>{plan.description}</CardDescription>}
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold">₹{finalPrice(plan)}</span>
        {plan.discountPercent ? <span className="text-sm text-muted line-through">₹{plan.price}</span> : null}
      </div>
      <div className="text-xs text-muted">{plan.durationDays} days</div>
      {plan.benefits.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1">
          {plan.benefits.map((b) => (
            <li key={b} className="flex items-center gap-2 text-xs text-muted">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent-2" /> {b}
            </li>
          ))}
        </ul>
      )}
      <Button className="mt-2" disabled={isPending} onClick={onBuy}>
        {isPending ? "Processing..." : "Purchase"}
      </Button>
    </Card>
  );
}

function MembershipContent() {
  const queryClient = useQueryClient();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const { data: plans } = useQuery({ queryKey: ["membership-plans"], queryFn: listMembershipPlans });
  const { data: membership } = useQuery({ queryKey: ["my-membership"], queryFn: getMyMembership });
  const { data: payments } = useQuery({ queryKey: ["my-payments"], queryFn: listMyPayments });

  function refreshAfterPurchase() {
    queryClient.invalidateQueries({ queryKey: ["my-membership"] });
    queryClient.invalidateQueries({ queryKey: ["my-payments"] });
  }

  const verifyMutation = useMutation({
    mutationFn: verifyPayment,
    onSuccess: refreshAfterPurchase,
    onError: () => setCheckoutError("Payment verification failed. If money was deducted, it will be refunded automatically."),
  });

  const checkoutMutation = useMutation({
    mutationFn: (planId: string) => checkout(planId, "RAZORPAY"),
    onSuccess: (result) => {
      setCheckoutError(null);

      if (!result.requiresPayment) {
        // Demo mode (no Razorpay keys configured yet) — already completed server-side.
        refreshAfterPurchase();
        return;
      }

      if (!window.Razorpay) {
        setCheckoutError("Payment widget failed to load. Please refresh and try again.");
        return;
      }

      const razorpay = new window.Razorpay({
        key: result.keyId,
        amount: result.amount,
        currency: result.currency,
        order_id: result.orderId,
        name: "King's Fitness",
        description: "Membership purchase",
        handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          verifyMutation.mutate({
            paymentId: result.paymentId!,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
        },
        modal: {
          ondismiss: () => setCheckoutError("Payment cancelled."),
        },
      });
      razorpay.open();
    },
    onError: () => setCheckoutError("Could not start checkout. Please try again."),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-semibold">
        Membership
      </motion.h1>
      <p className="mt-1 text-muted">Manage your plan and payment history.</p>

      {checkoutError && <p className="mt-3 text-sm text-danger">{checkoutError}</p>}

      {membership && (
        <Card className="mt-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current status</CardTitle>
              <CardDescription className="mt-1">
                {membership.hasMembership
                  ? `${membership.membership!.plan.name} — expires ${format(
                      new Date(membership.membership!.endDate),
                      "PP"
                    )}`
                  : "No membership yet"}
              </CardDescription>
            </div>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                membership.isActive ? "bg-accent-2/15 text-accent-2" : "bg-danger/15 text-danger"
              )}
            >
              {membership.isActive ? "ACTIVE" : membership.hasMembership ? "EXPIRED" : "NONE"}
            </span>
          </div>
        </Card>
      )}

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wide text-muted">Plans</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans?.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isPending={checkoutMutation.isPending || verifyMutation.isPending}
            onBuy={() => checkoutMutation.mutate(plan.id)}
          />
        ))}
      </div>

      <h2 className="mt-10 mb-3 text-sm font-medium uppercase tracking-wide text-muted">Payment history</h2>
      <div className="flex flex-col gap-2">
        {payments?.length === 0 && (
          <Card>
            <CardDescription>No payments yet.</CardDescription>
          </Card>
        )}
        {payments?.map((p) => (
          <Card key={p.id} className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <CreditCard className="h-4 w-4 text-accent" />
              <div>
                <div className="text-sm font-medium">{p.plan.name}</div>
                <div className="text-xs text-muted">{format(new Date(p.createdAt), "PPp")}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                ₹{p.amount} <span className="text-xs text-muted">({p.gateway})</span>
              </span>
              <InvoiceButton paymentId={p.id} />
              <Button
                variant="glass"
                size="sm"
                onClick={() => downloadInvoicePdf(p.id, p.invoiceNumber)}
              >
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function InvoiceButton({ paymentId }: { paymentId: string }) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["invoice", paymentId],
    queryFn: () => getInvoice(paymentId),
    enabled: open,
  });

  return (
    <div className="relative">
      <Button variant="glass" size="sm" onClick={() => setOpen((o) => !o)}>
        <Receipt className="h-3.5 w-3.5" /> Invoice
      </Button>
      {open && data && (
        <div className="glass-card absolute right-0 top-11 z-10 w-64 p-4 text-left text-xs">
          <div className="font-medium">{data.invoiceNumber}</div>
          <div className="mt-2 text-muted">{data.plan.name}</div>
          <div className="mt-1 text-muted">{data.plan.durationDays} days</div>
          <div className="mt-2 font-medium">
            ₹{data.amount} · {data.status}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MembershipPage() {
  return (
    <RequireAuth>
      <MembershipContent />
    </RequireAuth>
  );
}
