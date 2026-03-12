ALTER TABLE "project_settings"
ADD COLUMN "defaultExecutionMode" TEXT DEFAULT 'safe';

UPDATE "project_settings"
SET "defaultExecutionMode" = 'safe'
WHERE "defaultExecutionMode" IS NULL;
