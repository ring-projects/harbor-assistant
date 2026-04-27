CREATE TABLE "background_jobs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "dedupeKey" TEXT,
  "payload" JSON NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "runAfter" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" DATETIME,
  "lockedBy" TEXT,
  "lastError" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "completedAt" DATETIME
);

CREATE INDEX "background_jobs_status_runAfter_createdAt_idx"
ON "background_jobs"("status", "runAfter", "createdAt" DESC);

CREATE INDEX "background_jobs_dedupeKey_status_createdAt_idx"
ON "background_jobs"("dedupeKey", "status", "createdAt" DESC);
