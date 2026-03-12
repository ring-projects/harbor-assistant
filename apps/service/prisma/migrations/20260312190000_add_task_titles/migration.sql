ALTER TABLE "tasks"
ADD COLUMN "title" TEXT NOT NULL DEFAULT '';

ALTER TABLE "tasks"
ADD COLUMN "titleSource" TEXT NOT NULL DEFAULT 'prompt';

ALTER TABLE "tasks"
ADD COLUMN "titleUpdatedAt" DATETIME;

UPDATE "tasks"
SET
  "title" = "prompt",
  "titleSource" = 'prompt',
  "titleUpdatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "title" = '';
