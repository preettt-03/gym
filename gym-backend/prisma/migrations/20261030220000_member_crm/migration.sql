-- Admin member CRM: contact details, tags, locker/RFID, PT sessions, staff notes,
-- membership freeze and front-desk (cash) payments.
-- AlterEnum
ALTER TYPE "MembershipStatus" ADD VALUE 'FROZEN';

-- AlterEnum
ALTER TYPE "PaymentGateway" ADD VALUE 'CASH';

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "frozenAt" TIMESTAMP(3),
ADD COLUMN     "resumeAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "note" TEXT,
ADD COLUMN     "recordedById" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "emergencyContactRelation" TEXT,
ADD COLUMN     "lockerNumber" TEXT,
ADD COLUMN     "medicalNotes" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "ptSessionsTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ptSessionsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rfidTagId" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "staff_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "followUpDate" TIMESTAMP(3),
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pt_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trainerId" TEXT,
    "recordedById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pt_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_notes_userId_createdAt_idx" ON "staff_notes"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "staff_notes_followUpDate_idx" ON "staff_notes"("followUpDate");

-- CreateIndex
CREATE INDEX "pt_sessions_userId_completedAt_idx" ON "pt_sessions"("userId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_lockerNumber_key" ON "users"("lockerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "users_rfidTagId_key" ON "users"("rfidTagId");

-- AddForeignKey
ALTER TABLE "staff_notes" ADD CONSTRAINT "staff_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_notes" ADD CONSTRAINT "staff_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pt_sessions" ADD CONSTRAINT "pt_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pt_sessions" ADD CONSTRAINT "pt_sessions_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

