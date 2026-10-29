import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "glass-input h-11 w-full px-4 text-sm outline-none transition-colors placeholder:text-muted focus:border-gold/60 focus:ring-2 focus:ring-gold/25",
        "aria-invalid:border-danger/70 aria-invalid:focus:ring-danger/25",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
