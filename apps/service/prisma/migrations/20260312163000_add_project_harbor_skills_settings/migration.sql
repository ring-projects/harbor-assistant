ALTER TABLE "project_settings"
ADD COLUMN "harborSkillsEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "project_settings"
ADD COLUMN "harborSkillProfile" TEXT DEFAULT 'default';

UPDATE "project_settings"
SET "harborSkillProfile" = 'default'
WHERE "harborSkillProfile" IS NULL;
