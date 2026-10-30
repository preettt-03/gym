import { useEffect, useState } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { textareaClass } from "@/lib/member-ui";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/form-message";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("glass-card min-w-0 p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {Icon && <Icon className="h-4 w-4 text-gold" />}
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

/** Confirmation that asks why — the reason is stored in the audit log with the action. */
export function ReasonDialog({
  open,
  title,
  message,
  confirmLabel,
  required = true,
  destructive = true,
  pending,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  required?: boolean;
  destructive?: boolean;
  pending: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (open) {
      setReason("");
      setError(undefined);
    }
  }, [open]);

  const submit = () => {
    const text = reason.trim();
    if (required && text.length < 3) return setError("Give a short reason — it's kept in the audit log");
    onConfirm(text);
  };

  return (
    <Dialog
      open={open}
      onClose={pending ? () => {} : onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="glass" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm">
        <div className="text-muted">{message}</div>
        {children}
        <div>
          <label htmlFor="action-reason" className="mb-1.5 block font-medium">
            Reason {!required && <span className="font-normal text-muted">(optional)</span>}
          </label>
          <textarea
            id="action-reason"
            data-autofocus
            rows={2}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby="action-reason-error"
            className={textareaClass}
          />
          <FieldError id="action-reason-error" message={error} />
        </div>
      </div>
    </Dialog>
  );
}

/** Small pill used for tags and statuses. */
export function Pill({ children, tone = "muted", className }: { children: React.ReactNode; tone?: "gold" | "muted" | "success" | "warning" | "danger"; className?: string }) {
  const tones = {
    gold: "border-gold/30 bg-gold/10 text-gold",
    muted: "border-border text-muted",
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-[#fab219]/35 bg-[#fab219]/10 text-[#fab219]",
    danger: "border-danger/35 bg-danger/10 text-danger",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}
