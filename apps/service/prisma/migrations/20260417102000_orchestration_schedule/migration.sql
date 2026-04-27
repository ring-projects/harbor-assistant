CREATE TABLE "orchestration_schedules" (
    "orchestrationId" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cronExpression" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "concurrencyPolicy" TEXT NOT NULL DEFAULT 'skip',
    "taskTitle" TEXT,
    "taskPrompt" TEXT,
    "taskItems" JSON NOT NULL,
    "taskExecutor" TEXT NOT NULL,
    "taskModel" TEXT NOT NULL,
    "taskExecutionMode" TEXT NOT NULL,
    "taskEffort" TEXT NOT NULL,
    "lastTriggeredAt" DATETIME,
    "nextTriggerAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "orchestration_schedules_orchestrationId_fkey" FOREIGN KEY ("orchestrationId") REFERENCES "orchestrations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "orchestration_schedules_enabled_nextTriggerAt_idx"
ON "orchestration_schedules"("enabled", "nextTriggerAt");
