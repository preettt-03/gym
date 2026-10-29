-- Exercise cards get a dedicated thumbnail; detail pages an admin-written coach tip.
ALTER TABLE "exercises" ADD COLUMN "thumbnailUrl" TEXT;
ALTER TABLE "exercises" ADD COLUMN "coachTip" TEXT;
