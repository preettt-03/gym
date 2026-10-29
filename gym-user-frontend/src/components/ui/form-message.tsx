"use client";

import { AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Inline field error. Always mounted (empty when valid) so aria-describedby
// on the input never points at a missing id.
export function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <div id={id} aria-live="polite">
      <AnimatePresence initial={false}>
        {message && (
          <motion.p
            key={message}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-1.5 overflow-hidden pt-1.5 text-xs text-danger"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// Form-level error from the server (wrong password, account locked, ...).
export function FormAlert({ message, className }: { message: string | null; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={cn(
            "flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger",
            className
          )}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const STRENGTH_LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"] as const;
const STRENGTH_COLORS = ["bg-danger", "bg-danger", "bg-gold-dark", "bg-gold", "bg-success"] as const;

// 0 = under the 8-character minimum; 1–4 = how many extra traits it has.
export function passwordStrength(password: string) {
  if (password.length < 8) return 0;
  let score = 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score++;
  return score;
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = passwordStrength(password);

  return (
    <div className="pt-2" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              score >= step ? STRENGTH_COLORS[score] : "bg-surface-2"
            )}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">
        Password strength: <span className="font-medium text-foreground">{STRENGTH_LABELS[score]}</span>
        {score > 0 && score < 4 && " — mix upper & lower case, numbers and symbols"}
      </p>
    </div>
  );
}
