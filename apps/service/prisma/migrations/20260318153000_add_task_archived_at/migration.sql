ALTER TABLE "tasks" ADD COLUMN "archivedAt" DATETIME;

CREATE INDEX "tasks_projectId_archivedAt_createdAt_idx"
ON "tasks"("projectId", "archivedAt", "createdAt" DESC);
