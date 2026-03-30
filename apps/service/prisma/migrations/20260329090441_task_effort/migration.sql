-- CreateTable
CREATE TABLE "executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerType" TEXT NOT NULL DEFAULT 'task',
    "ownerId" TEXT NOT NULL,
    "executorType" TEXT NOT NULL,
    "executorModel" TEXT,
    "executionMode" TEXT,
    "executorEffort" TEXT,
    "workingDirectory" TEXT NOT NULL,
    "sessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "exitCode" INTEGER,
    "errorMessage" TEXT,
    "command" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "executions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "execution_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "executionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "rawEventType" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "execution_events_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "executions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "rootPath" TEXT NOT NULL,
    "normalizedPath" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastOpenedAt" DATETIME,
    "logRetentionDays" INTEGER DEFAULT 30,
    "eventRetentionDays" INTEGER DEFAULT 7,
    "harborSkillsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "harborSkillProfile" TEXT DEFAULT 'default',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleSource" TEXT NOT NULL DEFAULT 'prompt',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "executions_ownerId_key" ON "executions"("ownerId");

-- CreateIndex
CREATE INDEX "executions_status_createdAt_idx" ON "executions"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "executions_sessionId_status_createdAt_idx" ON "executions"("sessionId", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "executions_ownerType_ownerId_key" ON "executions"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "execution_events_executionId_createdAt_idx" ON "execution_events"("executionId", "createdAt" ASC);

-- CreateIndex
CREATE INDEX "execution_events_executionId_source_sequence_idx" ON "execution_events"("executionId", "source", "sequence");

-- CreateIndex
CREATE INDEX "execution_events_executionId_rawEventType_sequence_idx" ON "execution_events"("executionId", "rawEventType", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "execution_events_executionId_sequence_key" ON "execution_events"("executionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "projects_normalizedPath_key" ON "projects"("normalizedPath");

-- CreateIndex
CREATE INDEX "projects_status_updatedAt_idx" ON "projects"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "tasks_projectId_createdAt_idx" ON "tasks"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "tasks_projectId_archivedAt_createdAt_idx" ON "tasks"("projectId", "archivedAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "tasks_status_createdAt_idx" ON "tasks"("status", "createdAt" DESC);
