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
