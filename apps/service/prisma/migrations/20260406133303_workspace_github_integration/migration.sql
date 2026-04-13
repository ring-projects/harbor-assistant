-- CreateTable
CREATE TABLE "workspace_github_installations" (
    "workspaceId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "linkedByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("workspaceId", "installationId"),
    CONSTRAINT "workspace_github_installations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workspace_github_installations_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "github_app_installations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workspace_github_installations_linkedByUserId_fkey" FOREIGN KEY ("linkedByUserId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "workspace_github_installations_installationId_updatedAt_idx" ON "workspace_github_installations"("installationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "workspace_github_installations_linkedByUserId_updatedAt_idx" ON "workspace_github_installations"("linkedByUserId", "updatedAt" DESC);
