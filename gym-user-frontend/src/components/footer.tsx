import Link from "next/link";
import { Clock, MapPin, Phone, Star } from "lucide-react";
import { InstagramIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { ThemeMenu } from "@/components/theme-toggle";
import { BRAND } from "@/lib/brand";

const LINK_GROUPS = [
  {
    title: "Explore",
    links: [
      { href: "/about", label: "About us" },
      { href: "/exercises", label: "Exercises" },
      { href: "/pricing", label: "Membership" },
      { href: "/gallery", label: "Gallery" },
      { href: "/tools", label: "Fitness tools" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/faq", label: "FAQ" },
      { href: "/blog", label: "Blog" },
      { href: "/login", label: "Member login" },
      { href: "/register", label: "Join now" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.4fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted">
            Strength, discipline and community. Train with expert coaches and track every rep, meal and milestone.
          </p>
          <p className="mt-5 font-display text-sm uppercase tracking-[0.3em] text-gold">{BRAND.tagline}</p>
          <div className="mt-6 flex gap-3">
            <a
              href={BRAND.social.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`King's Fitness on Instagram (${BRAND.social.instagram.handle})`}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted transition-colors hover:border-gold hover:text-gold"
            >
              <InstagramIcon className="h-5 w-5" />
            </a>
            <a
              href={BRAND.maps.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`King's Fitness on Google — rated ${BRAND.rating.score}`}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm text-muted transition-colors hover:border-gold hover:text-gold"
            >
              <Star className="h-4 w-4 fill-gold text-gold" /> {BRAND.rating.score} on Google
            </a>
          </div>
        </div>

        {LINK_GROUPS.map((group) => (
          <div key={group.title}>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-foreground">{group.title}</h2>
            <ul className="mt-5 flex flex-col gap-3">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted transition-colors hover:text-gold">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-foreground">Visit us</h2>
          <ul className="mt-5 flex flex-col gap-4 text-sm text-muted">
            <li>
              <a href={BRAND.maps.directionsUrl} target="_blank" rel="noopener noreferrer" className="flex gap-3 hover:text-gold">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                {BRAND.contact.shortAddress}
              </a>
            </li>
            <li>
              <a href={`tel:${BRAND.contact.phone.replace(/\s/g, "")}`} className="flex gap-3 hover:text-gold">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                {BRAND.contact.phone}
              </a>
            </li>
            <li className="flex gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <span>
                {BRAND.hours.map((h) => (
                  <span key={h.days} className="block">
                    {h.days}: {h.time}
                  </span>
                ))}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </p>
          <ThemeMenu />
        </div>
      </div>
    </footer>
  );
}
