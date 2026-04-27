-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN "codexBaseUrl" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "codexApiKey" TEXT;

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "codexBaseUrl";
ALTER TABLE "projects" DROP COLUMN "codexApiKey";
