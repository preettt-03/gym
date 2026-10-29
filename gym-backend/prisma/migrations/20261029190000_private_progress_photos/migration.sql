-- Progress photos move to private storage: new rows reference a private file by key.
ALTER TABLE "progress_photos" ALTER COLUMN "photoUrl" DROP NOT NULL;
ALTER TABLE "progress_photos" ADD COLUMN "storageKey" TEXT;
CREATE UNIQUE INDEX "progress_photos_storageKey_key" ON "progress_photos"("storageKey");
