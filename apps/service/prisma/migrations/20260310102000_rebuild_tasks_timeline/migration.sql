DROP TABLE IF EXISTS "task_messages";
DROP TABLE IF EXISTS "task_events";
DROP TABLE IF EXISTS "task_runs";
DROP TABLE IF EXISTS "task_threads";
DROP TABLE IF EXISTS "tasks";

CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "projectPath" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "executor" TEXT NOT NULL,
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

CREATE TABLE "task_timeline_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT,
    "source" TEXT,
    "content" TEXT,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_timeline_items_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "tasks_projectId_createdAt_idx" ON "tasks"("projectId", "createdAt" DESC);
CREATE INDEX "tasks_status_createdAt_idx" ON "tasks"("status", "createdAt" DESC);
CREATE INDEX "tasks_threadId_status_createdAt_idx" ON "tasks"("threadId", "status", "createdAt" DESC);
CREATE INDEX "tasks_parentTaskId_createdAt_idx" ON "tasks"("parentTaskId", "createdAt" DESC);

CREATE UNIQUE INDEX "task_timeline_items_taskId_sequence_key" ON "task_timeline_items"("taskId", "sequence");
CREATE INDEX "task_timeline_items_taskId_createdAt_idx" ON "task_timeline_items"("taskId", "createdAt" ASC);
CREATE INDEX "task_timeline_items_taskId_kind_sequence_idx" ON "task_timeline_items"("taskId", "kind", "sequence");
