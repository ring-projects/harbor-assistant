PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_orchestrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "orchestrations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_orchestrations" (
    "id",
    "projectId",
    "title",
    "description",
    "status",
    "archivedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "projectId",
    "title",
    "description",
    "status",
    "archivedAt",
    "createdAt",
    "updatedAt"
FROM "orchestrations";

DROP TABLE "orchestrations";
ALTER TABLE "new_orchestrations" RENAME TO "orchestrations";

CREATE INDEX "orchestrations_projectId_createdAt_idx" ON "orchestrations"("projectId", "createdAt" DESC);
CREATE INDEX "orchestrations_projectId_archivedAt_createdAt_idx" ON "orchestrations"("projectId", "archivedAt", "createdAt" DESC);
CREATE INDEX "orchestrations_status_createdAt_idx" ON "orchestrations"("status", "createdAt" DESC);

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
