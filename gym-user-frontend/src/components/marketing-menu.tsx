"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/blog", label: "Blog" },
  { href: "/gallery", label: "Gallery" },
];

export function MarketingMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative hidden sm:block">
      <button
        className="flex items-center gap-1 text-sm text-muted hover:text-foreground"
        onClick={() => setOpen((o) => !o)}
      >
        More
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="glass-panel absolute left-0 top-8 z-50 w-40 p-2">
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-foreground/5 hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
