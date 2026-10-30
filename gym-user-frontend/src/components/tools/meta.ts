import { Disc3, Droplets, Dumbbell, Flame, Gauge, HeartPulse, PieChart, Ruler, Scale, Timer, type LucideIcon } from "lucide-react";
import type { ToolCategory } from "@/lib/tools-api";

// Icons live with the code (each calculator is code); the admin controls copy and visibility.
export const TOOL_ICONS: Record<string, LucideIcon> = {
  "1rm": Dumbbell,
  tdee: Flame,
  macros: PieChart,
  "body-fat": Ruler,
  bmr: Gauge,
  bmi: Scale,
  water: Droplets,
  "heart-rate": HeartPulse,
  "plate-loader": Disc3,
  timer: Timer,
};

export const CATEGORY_LABEL: Record<ToolCategory, string> = {
  STRENGTH: "Strength",
  NUTRITION: "Nutrition",
  BODY_COMP: "Body comp",
  CARDIO: "Cardio",
  TRAINING: "Training",
};
