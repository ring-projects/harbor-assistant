-- CreateTable
CREATE TABLE "task_agent_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_agent_events_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "task_agent_events_taskId_createdAt_idx" ON "task_agent_events"("taskId", "createdAt" ASC);

-- CreateIndex
CREATE INDEX "task_agent_events_taskId_eventType_sequence_idx" ON "task_agent_events"("taskId", "eventType", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "task_agent_events_taskId_sequence_key" ON "task_agent_events"("taskId", "sequence");
