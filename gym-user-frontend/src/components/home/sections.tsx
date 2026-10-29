import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bike,
  Bot,
  Check,
  Clock,
  Dumbbell,
  LineChart,
  MapPin,
  Music,
  Navigation,
  Phone,
  Repeat,
  Salad,
  Scale,
  Star,
  Swords,
  TrendingUp,
  UserCheck,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import { InstagramIcon } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import programCoaching from "@/assets/images/program-coaching.jpg";
import programEquipment from "@/assets/images/program-equipment.jpg";
import programPersonal from "@/assets/images/program-personal.jpg";
import gymInterior from "@/assets/images/gym-interior.jpg";
import trainingRopes from "@/assets/images/training-ropes.jpg";
import classMen from "@/assets/images/class-men.jpg";
import classWomen from "@/assets/images/class-women.jpg";
import ctaBg from "@/assets/images/cta-bg.jpg";

const CARD_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

const PROGRAMS = [
  {
    tag: "Coaching",
    title: "Personal training",
    body: "One-on-one coaching that corrects your form, plans your progression and keeps you honest every session.",
    image: programCoaching,
  },
  {
    tag: "Equipment",
    title: "Strength floor",
    body: "Free weights, racks, leg press and machines — everything you need to build real strength.",
    image: programEquipment,
  },
  {
    tag: "Nutrition",
    title: "Nutrition consulting",
    body: "Diet guidance built around your goal, routine and food habits — not a copy-paste template.",
    image: programPersonal,
  },
];

export function ProgramsSection() {
  return (
    <section id="programs" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24 sm:px-6">
      <Reveal>
        <SectionHeading
          eyebrow="Our programs"
          title={
            <>
              Make you grow <span className="text-gold">with our program</span>
            </>
          }
          description="Everything you need to train smarter and see results that last."
        />
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {PROGRAMS.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.1}>
            <article className="glass-card card-hover group h-full overflow-hidden">
              <div className="relative aspect-4/3 overflow-hidden">
                <Image
                  src={p.image}
                  alt=""
                  fill
                  placeholder="blur"
                  sizes={CARD_SIZES}
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{p.tag}</p>
                <h3 className="mt-2 text-xl font-semibold uppercase">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{p.body}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const ABOUT_POINTS = ["Crossfit, kickboxing & strength training", "Nutrition consulting for your goal", "Shower facility on site"];

export function AboutSection() {
  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <Reveal className="relative">
          <div className="relative aspect-4/3 overflow-hidden rounded-2xl border border-border">
            <Image
              src={gymInterior}
              alt="A fully equipped gym training floor"
              fill
              placeholder="blur"
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <a
            href={BRAND.maps.listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute -bottom-6 right-4 rounded-2xl border border-gold/40 bg-background px-6 py-4 shadow-2xl transition-colors hover:border-gold sm:-right-6"
          >
            <p className="flex items-center gap-2 font-display text-4xl font-bold text-gold">
              {BRAND.rating.score} <Star className="h-6 w-6 fill-gold" />
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">Rated on {BRAND.rating.source}</p>
          </a>
        </Reveal>

        <Reveal delay={0.1}>
          <SectionHeading
            align="left"
            eyebrow="Our story"
            title={
              <>
                A place for <span className="text-gold">your fitness goal</span>
              </>
            }
            description="King's Fitness in Fatehabad started with a simple idea: fitness shouldn't feel complicated. Everyone deserves the right guidance, the right environment and a plan that actually works for them."
          />
          <ul className="mt-8 flex flex-col gap-4">
            {ABOUT_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/15">
                  <Check className="h-3.5 w-3.5 text-gold" />
                </span>
                {point}
              </li>
            ))}
          </ul>
          <p className="mt-8 border-l-2 border-gold pl-4 italic text-foreground/80">
            Progress isn&apos;t about being perfect. It&apos;s about showing up.
          </p>
          <Link href="/about" className={cn(buttonVariants({ variant: "outline" }), "mt-8 uppercase tracking-wider")}>
            Learn more <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

const PHILOSOPHY = [
  { icon: Repeat, title: "Consistency", body: "Small, consistent efforts create lasting results." },
  { icon: TrendingUp, title: "Progress", body: "Focus on becoming better every day, not being perfect." },
  { icon: Scale, title: "Balance", body: "Build a stronger body while creating a healthier lifestyle." },
];

export function PhilosophySection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <Reveal>
        <SectionHeading
          eyebrow="Our philosophy"
          title={
            <>
              Train with purpose. <span className="text-gold">Live with strength.</span>
            </>
          }
        />
      </Reveal>
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {PHILOSOPHY.map((item, i) => (
          <Reveal key={item.title} delay={i * 0.1}>
            <div className="glass-card card-hover h-full p-8 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
                <item.icon className="h-6 w-6 text-gold" />
              </span>
              <h3 className="mt-5 text-xl font-semibold uppercase">{item.title}</h3>
              <p className="mt-2 text-sm text-muted">{item.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// Mirrors the services on the gym's Google Business listing.
const SERVICES = [
  { icon: Zap, title: "Crossfit", body: "High-intensity functional workouts that build strength and stamina." },
  { icon: Swords, title: "Kickboxing", body: "Conditioning, technique and stress-busting rounds on the bag." },
  { icon: Bike, title: "Cycling", body: "Cardio sessions that burn fat and build endurance." },
  { icon: Music, title: "Dance fitness", body: "Fun, high-energy classes that don't feel like a workout." },
  { icon: UserCheck, title: "Personal training", body: "One-on-one coaching tailored to your body and goal." },
  { icon: Salad, title: "Nutrition consulting", body: "Practical diet plans that fit your routine and taste." },
];

export function ServicesSection() {
  return (
    <section id="services" className="relative isolate scroll-mt-24 overflow-hidden">
      <Image src={trainingRopes} alt="" fill placeholder="blur" sizes="100vw" className="-z-20 object-cover" />
      <div className="absolute inset-0 -z-10 bg-background/90" />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
        <Reveal>
          <SectionHeading
            align="left"
            eyebrow="What we offer"
            title={
              <>
                Services <span className="text-gold">for you</span>
              </>
            }
            description="Whatever your goal, we have a proven path to get you there — from your first session to your next personal record."
          />
          <Link href="/register" className={cn(buttonVariants(), "mt-8 uppercase tracking-wider")}>
            Join us
          </Link>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.06}>
              <div className="card-hover h-full rounded-2xl border border-border bg-surface/80 p-6 backdrop-blur-sm">
                <s.icon className="h-7 w-7 text-gold" />
                <h3 className="mt-4 text-lg font-semibold uppercase">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const CLASSES = [
  {
    title: "Men's class",
    body: "Strength-first programming to build muscle, power and confidence under the bar.",
    image: classMen,
    alt: "Man training at the dumbbell rack",
  },
  {
    title: "Women's class",
    body: "Strength and conditioning designed to build lean muscle, stamina and serious confidence.",
    image: classWomen,
    alt: "Woman performing a barbell squat",
  },
];

export function ClassesSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <div className="grid gap-6 md:grid-cols-2">
        {CLASSES.map((c, i) => (
          <Reveal key={c.title} delay={i * 0.1}>
            <article className="group relative isolate flex min-h-80 overflow-hidden rounded-2xl border border-border sm:min-h-96">
              <Image
                src={c.image}
                alt={c.alt}
                fill
                placeholder="blur"
                sizes="(min-width: 768px) 50vw, 100vw"
                className="-z-20 object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 -z-10 bg-linear-to-t from-background via-background/60 to-transparent" />
              <div className="mt-auto p-8">
                <h3 className="text-3xl font-bold uppercase">{c.title}</h3>
                <p className="mt-2 max-w-sm text-sm text-foreground/75">{c.body}</p>
                <Link href="/pricing" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gold">
                  View plans <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: Dumbbell, title: "Workout plans", body: "Follow coach-built programs or generate your own, tracked set by set.", href: "/workout-plans" },
  { icon: UtensilsCrossed, title: "Diet & nutrition", body: "Log meals against a real food database and hit your daily macros.", href: "/nutrition" },
  { icon: LineChart, title: "Progress tracking", body: "Weight trends, progress photos, streaks and missions in one dashboard.", href: "/progress" },
  { icon: Bot, title: "AI coach", body: "Ask anything about training or nutrition and get answers instantly.", href: "/ai-coach" },
];

export function FeaturesSection() {
  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <Reveal>
          <SectionHeading
            eyebrow="Member app"
            title={
              <>
                Everything you need to <span className="text-gold">keep moving forward</span>
              </>
            }
            description="Your membership includes the King's Fitness app — your coach, planner and tracker in your pocket."
          />
        </Reveal>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.08}>
              <Link href={f.href} className="glass-card card-hover group flex h-full flex-col bg-background p-7">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10">
                  <f.icon className="h-6 w-6 text-gold" />
                </span>
                <h3 className="mt-5 text-lg font-semibold uppercase">{f.title}</h3>
                <p className="mt-2 flex-1 text-sm text-muted">{f.body}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gold">
                  Explore <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const INSTAGRAM_DIR = path.join(process.cwd(), "public", "instagram");
const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i;

// Photos saved from the gym's Instagram go in public/instagram/ — they're
// picked up at build time, newest filename first. With none, only the follow
// banner renders.
function instagramPhotos() {
  try {
    return fs
      .readdirSync(INSTAGRAM_DIR)
      .filter((f) => IMAGE_EXT.test(f))
      .sort()
      .reverse()
      .slice(0, 8)
      .map((f) => `/instagram/${f}`);
  } catch {
    return [];
  }
}

export function InstagramSection() {
  const photos = instagramPhotos();
  const { handle, url } = BRAND.social.instagram;

  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <Reveal>
        <SectionHeading
          eyebrow="Follow us"
          title={
            <>
              Life at <span className="text-gold">King&apos;s Fitness</span>
            </>
          }
          description="Workouts, transformations and gym-floor moments — follow along on Instagram."
        />
      </Reveal>

      {photos.length > 0 && (
        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((src, i) => (
            <Reveal key={src} delay={Math.min(i * 0.05, 0.3)}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block aspect-square overflow-hidden rounded-2xl border border-border bg-surface-2"
              >
                <Image
                  src={src}
                  alt={`King's Fitness on Instagram, photo ${i + 1}`}
                  fill
                  sizes="(min-width: 640px) 25vw, 50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <InstagramIcon className="h-8 w-8 text-gold" />
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      )}

      <Reveal className="mt-10 text-center">
        <a href={url} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "uppercase tracking-wider")}>
          <InstagramIcon className="h-5 w-5" /> Follow {handle}
        </a>
      </Reveal>
    </section>
  );
}

export function LocationSection() {
  const { contact, hours, maps, rating } = BRAND;
  const tel = `tel:${contact.phone.replace(/\s/g, "")}`;

  return (
    <section id="location" className="scroll-mt-24 border-y border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:items-center">
        <Reveal>
          <SectionHeading
            align="left"
            eyebrow="Visit us"
            title={
              <>
                Come train <span className="text-gold">with us</span>
              </>
            }
          />
          <ul className="mt-8 flex flex-col gap-5">
            <li className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/10">
                <MapPin className="h-5 w-5 text-gold" />
              </span>
              <span>
                <span className="block text-xs uppercase tracking-widest text-muted">Address</span>
                <span className="mt-1 block leading-relaxed">{contact.address}</span>
              </span>
            </li>
            <li className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/10">
                <Phone className="h-5 w-5 text-gold" />
              </span>
              <span>
                <span className="block text-xs uppercase tracking-widest text-muted">Phone</span>
                <a href={tel} className="mt-1 block hover:text-gold">
                  {contact.phone}
                </a>
              </span>
            </li>
            <li className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/10">
                <Clock className="h-5 w-5 text-gold" />
              </span>
              <span>
                <span className="block text-xs uppercase tracking-widest text-muted">Hours</span>
                {hours.map((h) => (
                  <span key={h.days} className="mt-1 block">
                    {h.days} · {h.time}
                  </span>
                ))}
              </span>
            </li>
            <li className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/10">
                <Star className="h-5 w-5 fill-gold text-gold" />
              </span>
              <span>
                <span className="block text-xs uppercase tracking-widest text-muted">Reviews</span>
                <a href={maps.listingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block hover:text-gold">
                  {rating.score} ★ on {rating.source} — read reviews
                </a>
              </span>
            </li>
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={maps.directionsUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants(), "uppercase tracking-wider")}>
              <Navigation className="h-4 w-4" /> Get directions
            </a>
            <a href={tel} className={cn(buttonVariants({ variant: "outline" }), "uppercase tracking-wider")}>
              <Phone className="h-4 w-4" /> Call now
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative aspect-4/3 overflow-hidden rounded-2xl border border-border bg-surface-2">
            <iframe
              src={maps.embedUrl}
              title="King's Fitness location on Google Maps"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 h-full w-full border-0 grayscale invert-[0.9] hue-rotate-180"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function CtaSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-3xl border border-gold/30 px-6 py-20 text-center sm:px-16">
          <Image src={ctaBg} alt="" fill placeholder="blur" sizes="(min-width: 1280px) 1280px, 100vw" className="-z-20 object-cover grayscale" />
          <div className="absolute inset-0 -z-10 bg-linear-to-br from-background/95 via-background/85 to-gold/25" />
          <Zap className="mx-auto h-10 w-10 text-gold" />
          <h2 className="mx-auto mt-6 max-w-2xl text-4xl font-bold uppercase leading-tight sm:text-5xl">
            Ready to become your <span className="text-gold">strongest self?</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-foreground/75">
            Whether you&apos;re taking your first step or chasing your next milestone, we&apos;re here to keep you
            moving forward.
          </p>
          <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "mt-10 uppercase tracking-wider")}>
            Start your journey <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
