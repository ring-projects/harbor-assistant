-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_project_settings" (
    "projectId" TEXT NOT NULL PRIMARY KEY,
    "defaultExecutor" TEXT DEFAULT 'codex',
    "defaultModel" TEXT,
    "defaultExecutionMode" TEXT DEFAULT 'safe',
    "maxConcurrentTasks" INTEGER NOT NULL DEFAULT 1,
    "logRetentionDays" INTEGER DEFAULT 30,
    "eventRetentionDays" INTEGER DEFAULT 7,
    "harborSkillsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "harborSkillProfile" TEXT DEFAULT 'default',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "project_settings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_project_settings" ("createdAt", "defaultExecutionMode", "defaultExecutor", "defaultModel", "eventRetentionDays", "harborSkillProfile", "harborSkillsEnabled", "logRetentionDays", "maxConcurrentTasks", "projectId", "updatedAt") SELECT "createdAt", "defaultExecutionMode", "defaultExecutor", "defaultModel", "eventRetentionDays", "harborSkillProfile", "harborSkillsEnabled", "logRetentionDays", "maxConcurrentTasks", "projectId", "updatedAt" FROM "project_settings";
DROP TABLE "project_settings";
ALTER TABLE "new_project_settings" RENAME TO "project_settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
