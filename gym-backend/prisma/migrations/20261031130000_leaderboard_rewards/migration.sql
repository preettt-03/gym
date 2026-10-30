-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'LEADERBOARD';

-- AlterTable
ALTER TABLE "leaderboard_settings" ADD COLUMN     "autoFreeze" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "displayKey" TEXT,
ADD COLUMN     "overtakeAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rewards" JSONB NOT NULL DEFAULT '{"daily":{"enabled":true,"coins":[50,30,20],"xp":[100,60,40]},"weekly":{"enabled":true,"coins":[300,200,100],"xp":[600,400,200]},"monthly":{"enabled":true,"coins":[1000,600,300],"xp":[2000,1200,600]}}',
ADD COLUMN     "weeklyWrapUp" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "leaderboard_snapshots" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "entries" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_awards" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "badgeName" TEXT,
    "celebratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_clearances" (
    "userId" TEXT NOT NULL,
    "clearedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clearedById" TEXT,

    CONSTRAINT "leaderboard_clearances_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "leaderboard_high_fives" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_high_fives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_snapshots_period_periodStart_key" ON "leaderboard_snapshots"("period", "periodStart");

-- CreateIndex
CREATE INDEX "leaderboard_awards_userId_celebratedAt_idx" ON "leaderboard_awards"("userId", "celebratedAt");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_awards_snapshotId_userId_key" ON "leaderboard_awards"("snapshotId", "userId");

-- CreateIndex
CREATE INDEX "leaderboard_high_fives_toUserId_period_periodStart_idx" ON "leaderboard_high_fives"("toUserId", "period", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_high_fives_fromUserId_toUserId_period_periodSta_key" ON "leaderboard_high_fives"("fromUserId", "toUserId", "period", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_settings_displayKey_key" ON "leaderboard_settings"("displayKey");

-- AddForeignKey
ALTER TABLE "leaderboard_awards" ADD CONSTRAINT "leaderboard_awards_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "leaderboard_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_awards" ADD CONSTRAINT "leaderboard_awards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_clearances" ADD CONSTRAINT "leaderboard_clearances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_high_fives" ADD CONSTRAINT "leaderboard_high_fives_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_high_fives" ADD CONSTRAINT "leaderboard_high_fives_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

