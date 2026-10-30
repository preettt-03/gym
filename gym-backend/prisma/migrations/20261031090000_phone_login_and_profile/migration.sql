-- Mobile-number sign-in (email becomes optional, phone unique + verified flag)
-- and richer member profiles: DOB, blood group, injuries, alternate phone, address.
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "alternatePhone" TEXT,
ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "injuries" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "state" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

