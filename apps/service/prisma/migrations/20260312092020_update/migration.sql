-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "projectPath" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleSource" TEXT NOT NULL DEFAULT 'prompt',
    "titleUpdatedAt" DATETIME,
    "executor" TEXT NOT NULL,
    "executionMode" TEXT,
    "runtimePolicy" TEXT,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "threadId" TEXT,
    "parentTaskId" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "exitCode" INTEGER,
    "command" TEXT,
    "stdout" TEXT NOT NULL DEFAULT '',
    "stderr" TEXT NOT NULL DEFAULT '',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("command", "createdAt", "error", "executionMode", "executor", "exitCode", "finishedAt", "id", "model", "parentTaskId", "projectId", "projectPath", "prompt", "runtimePolicy", "startedAt", "status", "stderr", "stdout", "threadId", "title", "titleSource", "titleUpdatedAt", "updatedAt") SELECT "command", "createdAt", "error", "executionMode", "executor", "exitCode", "finishedAt", "id", "model", "parentTaskId", "projectId", "projectPath", "prompt", "runtimePolicy", "startedAt", "status", "stderr", "stdout", "threadId", "title", "titleSource", "titleUpdatedAt", "updatedAt" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
CREATE INDEX "tasks_projectId_createdAt_idx" ON "tasks"("projectId", "createdAt" DESC);
CREATE INDEX "tasks_status_createdAt_idx" ON "tasks"("status", "createdAt" DESC);
CREATE INDEX "tasks_threadId_status_createdAt_idx" ON "tasks"("threadId", "status", "createdAt" DESC);
CREATE INDEX "tasks_parentTaskId_createdAt_idx" ON "tasks"("parentTaskId", "createdAt" DESC);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
