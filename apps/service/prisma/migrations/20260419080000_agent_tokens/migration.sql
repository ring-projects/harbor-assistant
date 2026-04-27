CREATE TABLE "agent_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "tokenHash" TEXT NOT NULL,
    "issuedByUserId" TEXT,
    "parentTokenId" TEXT,
    "projectId" TEXT,
    "orchestrationId" TEXT,
    "taskId" TEXT,
    "sourceTaskId" TEXT,
    "scopes" JSON NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "agent_tokens_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "agent_tokens_parentTokenId_fkey" FOREIGN KEY ("parentTokenId") REFERENCES "agent_tokens" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "agent_tokens_tokenHash_key" ON "agent_tokens"("tokenHash");
CREATE INDEX "agent_tokens_issuedByUserId_createdAt_idx" ON "agent_tokens"("issuedByUserId", "createdAt" DESC);
CREATE INDEX "agent_tokens_projectId_createdAt_idx" ON "agent_tokens"("projectId", "createdAt" DESC);
CREATE INDEX "agent_tokens_orchestrationId_createdAt_idx" ON "agent_tokens"("orchestrationId", "createdAt" DESC);
CREATE INDEX "agent_tokens_taskId_createdAt_idx" ON "agent_tokens"("taskId", "createdAt" DESC);
CREATE INDEX "agent_tokens_sourceTaskId_createdAt_idx" ON "agent_tokens"("sourceTaskId", "createdAt" DESC);
CREATE INDEX "agent_tokens_expiresAt_revokedAt_idx" ON "agent_tokens"("expiresAt", "revokedAt");
