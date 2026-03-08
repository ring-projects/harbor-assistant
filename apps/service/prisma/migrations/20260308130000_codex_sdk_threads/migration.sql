-- CreateTable
CREATE TABLE "task_threads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "projectPath" TEXT NOT NULL,
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyTaskId" TEXT,
    "projectId" TEXT NOT NULL,
    "projectPath" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "executor" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "threadId" TEXT,
    "parentTaskId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tasks_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "task_threads" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("createdAt", "executor", "id", "legacyTaskId", "model", "projectId", "projectPath", "prompt", "status", "updatedAt") SELECT "createdAt", "executor", "id", "legacyTaskId", "model", "projectId", "projectPath", "prompt", "status", "updatedAt" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable
CREATE TABLE "task_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "task_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "task_threads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_messages_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "task_threads_projectId_updatedAt_idx" ON "task_threads"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "tasks_legacyTaskId_key" ON "tasks"("legacyTaskId");

-- CreateIndex
CREATE INDEX "tasks_projectId_createdAt_idx" ON "tasks"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "tasks_status_createdAt_idx" ON "tasks"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "tasks_threadId_createdAt_idx" ON "tasks"("threadId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "tasks_parentTaskId_createdAt_idx" ON "tasks"("parentTaskId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "task_messages_threadId_sequence_key" ON "task_messages"("threadId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "task_messages_threadId_externalId_key" ON "task_messages"("threadId", "externalId");

-- CreateIndex
CREATE INDEX "task_messages_taskId_createdAt_idx" ON "task_messages"("taskId", "createdAt" ASC);

-- CreateIndex
CREATE INDEX "task_messages_threadId_createdAt_idx" ON "task_messages"("threadId", "createdAt" ASC);
