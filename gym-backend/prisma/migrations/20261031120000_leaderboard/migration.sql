-- CreateTable
CREATE TABLE "leaderboard_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "workoutPoints" INTEGER NOT NULL DEFAULT 50,
    "visitPoints" INTEGER NOT NULL DEFAULT 30,
    "caloriesPerPoint" INTEGER NOT NULL DEFAULT 10,
    "gymMinutePoints" INTEGER NOT NULL DEFAULT 1,
    "workoutMinutePoints" INTEGER NOT NULL DEFAULT 2,
    "streakPoints" INTEGER NOT NULL DEFAULT 25,
    "fraudDetection" BOOLEAN NOT NULL DEFAULT true,
    "maxWorkoutsPerDay" INTEGER NOT NULL DEFAULT 3,
    "maxCaloriesPerDay" INTEGER NOT NULL DEFAULT 3000,
    "maxGymMinutesPerVisit" INTEGER NOT NULL DEFAULT 300,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboard_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_adjustments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_exclusions" (
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_exclusions_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "leaderboard_adjustments_userId_effectiveAt_idx" ON "leaderboard_adjustments"("userId", "effectiveAt");

-- CreateIndex
CREATE INDEX "leaderboard_adjustments_effectiveAt_idx" ON "leaderboard_adjustments"("effectiveAt");

-- AddForeignKey
ALTER TABLE "leaderboard_adjustments" ADD CONSTRAINT "leaderboard_adjustments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_adjustments" ADD CONSTRAINT "leaderboard_adjustments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_exclusions" ADD CONSTRAINT "leaderboard_exclusions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
