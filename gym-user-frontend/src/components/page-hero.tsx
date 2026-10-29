import Image, { type StaticImageData } from "next/image";
import heroFallback from "@/assets/images/gym-interior.jpg";

// Banner used at the top of the inner marketing pages (about, pricing, faq…).
export function PageHero({
  eyebrow,
  title,
  description,
  image = heroFallback,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  image?: StaticImageData;
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-border">
      <Image
        src={image}
        alt=""
        fill
        preload
        placeholder="blur"
        sizes="100vw"
        className="-z-10 object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-background via-background/85 to-background/50" />
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold uppercase leading-tight sm:text-5xl lg:text-6xl">{title}</h1>
        {description && <p className="mt-5 max-w-xl text-lg text-muted">{description}</p>}
      </div>
    </section>
  );
}
