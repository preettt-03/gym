CREATE TYPE "ToolCategory" AS ENUM ('STRENGTH', 'NUTRITION', 'BODY_COMP', 'CARDIO', 'TRAINING');

CREATE TABLE "fitness_tools" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ToolCategory" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fitness_tools_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fitness_tools_slug_key" ON "fitness_tools"("slug");
CREATE INDEX "fitness_tools_position_idx" ON "fitness_tools"("position");

-- The ten calculators the member app ships with, all live by default.
INSERT INTO "fitness_tools" ("id", "slug", "title", "description", "category", "position", "updatedAt") VALUES
  (gen_random_uuid()::text, '1rm',          'One Rep Max (1RM)',          'Estimate your max lift from the weight and reps you just did.',          'STRENGTH',  0, NOW()),
  (gen_random_uuid()::text, 'tdee',         'TDEE & Calorie Needs',       'Daily calories to cut, maintain or bulk based on how active you are.',   'NUTRITION', 1, NOW()),
  (gen_random_uuid()::text, 'macros',       'Macro Split',                'Turn your calories into grams of protein, carbs and fat.',               'NUTRITION', 2, NOW()),
  (gen_random_uuid()::text, 'body-fat',     'Body Fat Percentage',        'US Navy method from neck, waist and hip measurements.',                  'BODY_COMP', 3, NOW()),
  (gen_random_uuid()::text, 'bmr',          'BMR (Basal Metabolic Rate)', 'Calories your body burns at complete rest.',                             'NUTRITION', 4, NOW()),
  (gen_random_uuid()::text, 'bmi',          'BMI Calculator',             'Body Mass Index and category from your height and weight.',              'BODY_COMP', 5, NOW()),
  (gen_random_uuid()::text, 'water',        'Daily Water Intake',         'How much to drink based on your weight and training.',                   'NUTRITION', 6, NOW()),
  (gen_random_uuid()::text, 'heart-rate',   'Target Heart Rate Zones',    'Fat-burn, aerobic and peak heart-rate zones for cardio.',                'CARDIO',    7, NOW()),
  (gen_random_uuid()::text, 'plate-loader', 'Plate Loading',              'Which plates to load on each side of the bar for a target weight.',      'STRENGTH',  8, NOW()),
  (gen_random_uuid()::text, 'timer',        'Rest Timer',                 'Countdown between sets with quick presets and a sound at zero.',         'TRAINING',  9, NOW());
