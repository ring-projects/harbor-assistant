-- CreateTable
CREATE TABLE "workspace_invitations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "inviteeGithubLogin" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invitedByUserId" TEXT NOT NULL,
    "acceptedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "acceptedAt" DATETIME,
    CONSTRAINT "workspace_invitations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workspace_invitations_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workspace_invitations_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "workspace_invitations_workspaceId_status_createdAt_idx" ON "workspace_invitations"("workspaceId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "workspace_invitations_inviteeGithubLogin_status_createdAt_idx" ON "workspace_invitations"("inviteeGithubLogin", "status", "createdAt" DESC);
