import { readdir } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

import { Database } from "bun:sqlite"

const CODEX_HOME_DIRECTORY = path.join(homedir(), ".codex")
const DEFAULT_THREAD_LIMIT = 120

export type CodexThreadSnapshot = {
  threadId: string
  rolloutPath: string
  cwd: string
  title: string | null
  firstUserMessage: string | null
  createdAt: string
  updatedAt: string
}

function toEpochMs(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }

  if (value > 1_000_000_000_000) {
    return Math.trunc(value)
  }

  if (value > 0) {
    return Math.trunc(value * 1_000)
  }

  return null
}

function toIsoTimestamp(value: unknown, fallback: number) {
  const epochMs = toEpochMs(value) ?? fallback
  return new Date(epochMs).toISOString()
}

async function getSqliteCandidates() {
  return readdir(CODEX_HOME_DIRECTORY)
    .then((entries) =>
      entries
        .filter((entry) => /^state_.*\.sqlite$/i.test(entry))
        .map((entry) => path.join(CODEX_HOME_DIRECTORY, entry))
        .sort((left, right) => right.localeCompare(left)),
    )
    .catch(() => [])
}

export async function listProjectCodexThreadSnapshots(args: {
  projectPath: string
  limit?: number
}): Promise<CodexThreadSnapshot[]> {
  const normalizedProjectPath = path.resolve(args.projectPath)
  const limit =
    typeof args.limit === "number" && Number.isFinite(args.limit)
      ? Math.max(1, Math.trunc(args.limit))
      : DEFAULT_THREAD_LIMIT

  const sqliteCandidates = await getSqliteCandidates()
  const deduplicated = new Map<string, CodexThreadSnapshot>()

  for (const sqlitePath of sqliteCandidates) {
    let db: Database | null = null

    try {
      db = new Database(sqlitePath, {
        readonly: true,
        create: false,
        strict: true,
      })

      const rows = db
        .query(
          `SELECT id, rollout_path, cwd, title, first_user_message, created_at, updated_at
           FROM threads
           WHERE cwd = ? AND archived = 0
           ORDER BY updated_at DESC
           LIMIT ?`,
        )
        .all(normalizedProjectPath, limit) as Array<{
        id?: unknown
        rollout_path?: unknown
        cwd?: unknown
        title?: unknown
        first_user_message?: unknown
        created_at?: unknown
        updated_at?: unknown
      }>

      const now = Date.now()
      for (const row of rows) {
        const threadId = typeof row.id === "string" ? row.id : null
        const rolloutPath =
          typeof row.rollout_path === "string" ? row.rollout_path : null
        const cwd = typeof row.cwd === "string" ? row.cwd : null

        if (!threadId || !rolloutPath || !cwd || deduplicated.has(threadId)) {
          continue
        }

        deduplicated.set(threadId, {
          threadId,
          rolloutPath,
          cwd,
          title: typeof row.title === "string" ? row.title : null,
          firstUserMessage:
            typeof row.first_user_message === "string"
              ? row.first_user_message
              : null,
          createdAt: toIsoTimestamp(row.created_at, now),
          updatedAt: toIsoTimestamp(row.updated_at, now),
        })
      }
    } catch {
      continue
    } finally {
      db?.close()
    }
  }

  return Array.from(deduplicated.values())
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    )
    .slice(0, limit)
}
