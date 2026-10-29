import { Hero } from "@/components/home/hero";
import {
  AboutSection,
  ClassesSection,
  CtaSection,
  FeaturesSection,
  InstagramSection,
  LocationSection,
  PhilosophySection,
  ProgramsSection,
  ServicesSection,
} from "@/components/home/sections";
import { PlansSection, TestimonialsSection } from "@/components/home/live-sections";

export function HomeContent() {
  return (
    <>
      <Hero />
      <ProgramsSection />
      <AboutSection />
      <PhilosophySection />
      <ServicesSection />
      <ClassesSection />
      <FeaturesSection />
      <PlansSection />
      <TestimonialsSection />
      <InstagramSection />
      <LocationSection />
      <CtaSection />
    </>
  );
}
