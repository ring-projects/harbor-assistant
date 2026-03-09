-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "rootPath" TEXT NOT NULL,
    "normalizedPath" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastOpenedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME
);

-- CreateTable
CREATE TABLE "project_settings" (
    "projectId" TEXT NOT NULL PRIMARY KEY,
    "defaultExecutor" TEXT DEFAULT 'codex',
    "defaultModel" TEXT,
    "maxConcurrentTasks" INTEGER NOT NULL DEFAULT 1,
    "logRetentionDays" INTEGER DEFAULT 30,
    "eventRetentionDays" INTEGER DEFAULT 7,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "project_settings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_mcp_servers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "serverName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "project_mcp_servers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "projects_normalizedPath_key" ON "projects"("normalizedPath");

-- CreateIndex
CREATE INDEX "projects_status_updatedAt_idx" ON "projects"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "project_mcp_servers_projectId_updatedAt_idx" ON "project_mcp_servers"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "project_mcp_servers_projectId_serverName_key" ON "project_mcp_servers"("projectId", "serverName");
