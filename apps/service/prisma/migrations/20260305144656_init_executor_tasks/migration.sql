-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyTaskId" TEXT,
    "projectId" TEXT NOT NULL,
    "projectPath" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "executor" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "task_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "command" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "exitCode" INTEGER,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "task_runs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_events_runId_fkey" FOREIGN KEY ("runId") REFERENCES "task_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "tasks_legacyTaskId_key" ON "tasks"("legacyTaskId");

-- CreateIndex
CREATE INDEX "tasks_projectId_createdAt_idx" ON "tasks"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "tasks_status_createdAt_idx" ON "tasks"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "task_runs_status_createdAt_idx" ON "task_runs"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "task_runs_taskId_createdAt_idx" ON "task_runs"("taskId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "task_runs_taskId_attempt_key" ON "task_runs"("taskId", "attempt");

-- CreateIndex
CREATE INDEX "task_events_runId_createdAt_idx" ON "task_events"("runId", "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "task_events_runId_sequence_key" ON "task_events"("runId", "sequence");
