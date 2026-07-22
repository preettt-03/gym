import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "glass-input h-11 w-full px-4 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-accent/50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
