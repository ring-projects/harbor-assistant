PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "orchestrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "defaultPrompt" TEXT,
    "defaultConfig" JSON,
    "status" TEXT NOT NULL DEFAULT 'active',
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "orchestrations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "orchestrations" (
    "id",
    "projectId",
    "title",
    "description",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    "projects"."id" || '-default',
    "projects"."id",
    "projects"."name",
    "projects"."description",
    CASE WHEN "projects"."archivedAt" IS NULL THEN 'active' ELSE 'archived' END,
    "projects"."createdAt",
    "projects"."updatedAt"
FROM "projects";

CREATE TABLE "new_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "orchestrationId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleSource" TEXT NOT NULL DEFAULT 'prompt',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tasks_orchestrationId_fkey" FOREIGN KEY ("orchestrationId") REFERENCES "orchestrations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_tasks" (
    "id",
    "projectId",
    "orchestrationId",
    "prompt",
    "title",
    "titleSource",
    "status",
    "startedAt",
    "finishedAt",
    "archivedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    "tasks"."id",
    "tasks"."projectId",
    "tasks"."projectId" || '-default',
    "tasks"."prompt",
    "tasks"."title",
    "tasks"."titleSource",
    "tasks"."status",
    "tasks"."startedAt",
    "tasks"."finishedAt",
    "tasks"."archivedAt",
    "tasks"."createdAt",
    "tasks"."updatedAt"
FROM "tasks";

DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";

CREATE INDEX "orchestrations_projectId_createdAt_idx" ON "orchestrations"("projectId", "createdAt" DESC);
CREATE INDEX "orchestrations_projectId_archivedAt_createdAt_idx" ON "orchestrations"("projectId", "archivedAt", "createdAt" DESC);
CREATE INDEX "orchestrations_status_createdAt_idx" ON "orchestrations"("status", "createdAt" DESC);
CREATE INDEX "tasks_projectId_createdAt_idx" ON "tasks"("projectId", "createdAt" DESC);
CREATE INDEX "tasks_orchestrationId_createdAt_idx" ON "tasks"("orchestrationId", "createdAt" DESC);
CREATE INDEX "tasks_projectId_orchestrationId_createdAt_idx" ON "tasks"("projectId", "orchestrationId", "createdAt" DESC);
CREATE INDEX "tasks_projectId_archivedAt_createdAt_idx" ON "tasks"("projectId", "archivedAt", "createdAt" DESC);
CREATE INDEX "tasks_status_createdAt_idx" ON "tasks"("status", "createdAt" DESC);

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
