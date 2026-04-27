CREATE TABLE "sandboxes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "providerSandboxId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" JSON NOT NULL,
    "workingDirectory" TEXT NOT NULL,
    "profile" JSON NOT NULL,
    "networkPolicy" JSON NOT NULL,
    "workspaceId" TEXT,
    "projectId" TEXT,
    "taskId" TEXT,
    "purpose" TEXT NOT NULL,
    "labels" JSON NOT NULL,
    "previewBaseUrl" TEXT,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastReadyAt" DATETIME,
    "stoppedAt" DATETIME
);

CREATE TABLE "sandbox_commands" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sandboxId" TEXT NOT NULL,
    "providerCommandId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "cwd" TEXT,
    "detached" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "exitCode" INTEGER,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    CONSTRAINT "sandbox_commands_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "sandboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "sandbox_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sandboxId" TEXT NOT NULL,
    "providerSnapshotId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sandbox_snapshots_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "sandboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sandboxes_providerSandboxId_key" ON "sandboxes"("providerSandboxId");
CREATE INDEX "sandboxes_projectId_createdAt_idx" ON "sandboxes"("projectId", "createdAt" DESC);
CREATE INDEX "sandboxes_taskId_createdAt_idx" ON "sandboxes"("taskId", "createdAt" DESC);
CREATE INDEX "sandboxes_status_updatedAt_idx" ON "sandboxes"("status", "updatedAt" DESC);

CREATE UNIQUE INDEX "sandbox_commands_sandboxId_providerCommandId_key" ON "sandbox_commands"("sandboxId", "providerCommandId");
CREATE INDEX "sandbox_commands_sandboxId_createdAt_idx" ON "sandbox_commands"("sandboxId", "createdAt" DESC);
CREATE INDEX "sandbox_commands_status_updatedAt_idx" ON "sandbox_commands"("status", "updatedAt" DESC);

CREATE UNIQUE INDEX "sandbox_snapshots_providerSnapshotId_key" ON "sandbox_snapshots"("providerSnapshotId");
CREATE INDEX "sandbox_snapshots_sandboxId_createdAt_idx" ON "sandbox_snapshots"("sandboxId", "createdAt" DESC);
