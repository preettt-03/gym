-- Exercises move from single media columns to an ordered list of photos and videos.
CREATE TYPE "ExerciseMediaType" AS ENUM ('IMAGE', 'VIDEO');

CREATE TABLE "exercise_media" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "type" "ExerciseMediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "isThumbnail" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exercise_media_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "exercise_media_exerciseId_position_idx" ON "exercise_media"("exerciseId", "position");
ALTER TABLE "exercise_media" ADD CONSTRAINT "exercise_media_exerciseId_fkey"
    FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry existing media over: the thumbnail first (flagged), then the gallery, then the video.
INSERT INTO "exercise_media" ("id", "exerciseId", "type", "url", "isThumbnail", "position")
SELECT gen_random_uuid()::text, "id", 'IMAGE', "thumbnailUrl", true, 0
FROM "exercises" WHERE "thumbnailUrl" IS NOT NULL;

INSERT INTO "exercise_media" ("id", "exerciseId", "type", "url", "isThumbnail", "position")
SELECT gen_random_uuid()::text, e."id", 'IMAGE', g.url, false, g.ord::int
FROM "exercises" e, unnest(e."images") WITH ORDINALITY AS g(url, ord)
WHERE g.url IS DISTINCT FROM e."thumbnailUrl";

INSERT INTO "exercise_media" ("id", "exerciseId", "type", "url", "isThumbnail", "position")
SELECT gen_random_uuid()::text, "id", 'VIDEO', "videoUrl", false, 1000
FROM "exercises" WHERE "videoUrl" IS NOT NULL;

ALTER TABLE "exercises" DROP COLUMN "images", DROP COLUMN "videoUrl", DROP COLUMN "thumbnailUrl";
