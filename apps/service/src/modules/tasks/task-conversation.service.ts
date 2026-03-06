import { readFile, readdir } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

import { Database } from "bun:sqlite"

import { listTaskEvents } from "./task.repository"

const CODEX_HOME_DIRECTORY = path.join(homedir(), ".codex")
const CODEX_SESSIONS_DIRECTORY = path.join(CODEX_HOME_DIRECTORY, "sessions")
const CODEX_SESSION_EVENT_KIND = "codex-session"
const SESSION_EVENT_SCAN_LIMIT = 5_000
const DEFAULT_CONVERSATION_LIMIT = 200
const MAX_CONVERSATION_LIMIT = 1_000
const THREAD_CANDIDATE_LIMIT_PER_DB = 120

type ConversationRole = "user" | "assistant" | "system"

export type TaskConversationMessage = {
  id: string
  role: ConversationRole
  content: string
  timestamp: string | null
}

export type TaskConversationResult = {
  taskId: string
  threadId: string | null
  rolloutPath: string | null
  messages: TaskConversationMessage[]
  truncated: boolean
}

type CodexSessionReference = {
  threadId: string | null
  rolloutPath: string | null
}

type CodexThreadLookup = {
  threadId: string | null
  rolloutPath: string
  cwd: string | null
}

type CodexThreadCandidate = {
  threadId: string
  rolloutPath: string
  cwd: string | null
  createdAtMs: number | null
  updatedAtMs: number | null
  firstUserMessage: string | null
  title: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function normalizeConversationLimit(limit: number | undefined) {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return DEFAULT_CONVERSATION_LIMIT
  }

  return Math.min(MAX_CONVERSATION_LIMIT, Math.max(1, Math.trunc(limit)))
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

function toIsoMs(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.getTime()
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function extractPromptSeed(prompt: string | null | undefined) {
  if (!prompt) {
    return null
  }

  const firstLine =
    prompt
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ""

  if (!firstLine) {
    return null
  }

  return normalizeText(firstLine).slice(0, 120)
}

function promptMatchesCandidate(args: {
  promptSeed: string | null
  candidate: CodexThreadCandidate
}) {
  if (!args.promptSeed || args.promptSeed.length < 12) {
    return false
  }

  const probe = args.promptSeed.slice(0, 64)
  const userMessage = args.candidate.firstUserMessage
    ? normalizeText(args.candidate.firstUserMessage)
    : ""
  const title = args.candidate.title ? normalizeText(args.candidate.title) : ""

  return userMessage.includes(probe) || title.includes(probe)
}

function isPathInsideRoot(rootPath: string, absolutePath: string) {
  const relative = path.relative(rootPath, absolutePath)
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  )
}

function getSqliteCandidates() {
  return readdir(CODEX_HOME_DIRECTORY)
    .then((entries) =>
      entries
        .filter((entry) => /^state_.*\.sqlite$/i.test(entry))
        .map((entry) => path.join(CODEX_HOME_DIRECTORY, entry))
        .sort((left, right) => right.localeCompare(left)),
    )
    .catch(() => [])
}

async function lookupCodexThread(threadId: string): Promise<CodexThreadLookup | null> {
  const sqliteCandidates = await getSqliteCandidates()

  for (const sqlitePath of sqliteCandidates) {
    let db: Database | null = null

    try {
      db = new Database(sqlitePath, {
        readonly: true,
        create: false,
        strict: true,
      })

      const row = db
        .query(
          `SELECT rollout_path, cwd
           FROM threads
           WHERE id = ?
           LIMIT 1`,
        )
        .get(threadId) as
        | {
            rollout_path?: unknown
            cwd?: unknown
          }
        | undefined

      const rolloutPath =
        row && typeof row.rollout_path === "string" ? row.rollout_path : null
      if (!rolloutPath) {
        continue
      }

      return {
        threadId,
        rolloutPath,
        cwd: row && typeof row.cwd === "string" ? row.cwd : null,
      }
    } catch {
      continue
    } finally {
      db?.close()
    }
  }

  return null
}

async function collectCodexThreadCandidates(args: {
  projectPath: string
}): Promise<CodexThreadCandidate[]> {
  const sqliteCandidates = await getSqliteCandidates()
  const normalizedProjectPath = path.resolve(args.projectPath)
  const deduplicated = new Map<string, CodexThreadCandidate>()

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
          `SELECT id, rollout_path, cwd, created_at, updated_at, first_user_message, title
           FROM threads
           WHERE cwd = ?
           ORDER BY updated_at DESC
           LIMIT ?`,
        )
        .all(normalizedProjectPath, THREAD_CANDIDATE_LIMIT_PER_DB) as Array<{
        id?: unknown
        rollout_path?: unknown
        cwd?: unknown
        created_at?: unknown
        updated_at?: unknown
        first_user_message?: unknown
        title?: unknown
      }>

      for (const row of rows) {
        const threadId = typeof row.id === "string" ? row.id : null
        const rolloutPath =
          typeof row.rollout_path === "string" ? row.rollout_path : null
        if (!threadId || !rolloutPath) {
          continue
        }

        if (deduplicated.has(threadId)) {
          continue
        }

        deduplicated.set(threadId, {
          threadId,
          rolloutPath,
          cwd: typeof row.cwd === "string" ? row.cwd : null,
          createdAtMs: toEpochMs(row.created_at),
          updatedAtMs: toEpochMs(row.updated_at),
          firstUserMessage:
            typeof row.first_user_message === "string"
              ? row.first_user_message
              : null,
          title: typeof row.title === "string" ? row.title : null,
        })
      }
    } catch {
      continue
    } finally {
      db?.close()
    }
  }

  return Array.from(deduplicated.values())
}

function selectBestCodexThreadCandidate(args: {
  candidates: CodexThreadCandidate[]
  taskCreatedAt: string | null | undefined
  taskPrompt: string | null | undefined
}) {
  if (args.candidates.length === 0) {
    return null
  }

  const promptSeed = extractPromptSeed(args.taskPrompt)
  const taskCreatedAtMs = toIsoMs(args.taskCreatedAt)

  const sorted = [...args.candidates].sort((left, right) => {
    const leftPromptMatched = promptMatchesCandidate({
      promptSeed,
      candidate: left,
    })
    const rightPromptMatched = promptMatchesCandidate({
      promptSeed,
      candidate: right,
    })

    if (leftPromptMatched !== rightPromptMatched) {
      return leftPromptMatched ? -1 : 1
    }

    if (taskCreatedAtMs !== null) {
      const leftTimestamp = left.createdAtMs ?? left.updatedAtMs
      const rightTimestamp = right.createdAtMs ?? right.updatedAtMs

      const leftDistance =
        leftTimestamp === null
          ? Number.POSITIVE_INFINITY
          : Math.abs(leftTimestamp - taskCreatedAtMs)
      const rightDistance =
        rightTimestamp === null
          ? Number.POSITIVE_INFINITY
          : Math.abs(rightTimestamp - taskCreatedAtMs)

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance
      }
    }

    return (right.updatedAtMs ?? 0) - (left.updatedAtMs ?? 0)
  })

  return sorted[0] ?? null
}

async function fallbackSessionReference(args: {
  projectPath: string
  taskCreatedAt: string | null | undefined
  taskPrompt: string | null | undefined
}): Promise<CodexSessionReference | null> {
  const candidates = await collectCodexThreadCandidates({
    projectPath: args.projectPath,
  })

  const best = selectBestCodexThreadCandidate({
    candidates,
    taskCreatedAt: args.taskCreatedAt,
    taskPrompt: args.taskPrompt,
  })

  if (!best) {
    return null
  }

  return {
    threadId: best.threadId,
    rolloutPath: best.rolloutPath,
  }
}

function extractMessageContent(content: unknown) {
  if (!Array.isArray(content)) {
    return ""
  }

  const chunks: string[] = []
  for (const item of content) {
    if (!isRecord(item)) {
      continue
    }

    if (typeof item.text === "string" && item.text.trim().length > 0) {
      chunks.push(item.text)
      continue
    }

    if (typeof item.content === "string" && item.content.trim().length > 0) {
      chunks.push(item.content)
      continue
    }
  }

  return chunks.join("\n").trim()
}

function normalizeConversationRole(value: unknown): ConversationRole | null {
  if (value === "user" || value === "assistant" || value === "system") {
    return value
  }

  return null
}

function extractSessionReference(payload: string): CodexSessionReference | null {
  const parsedPayload = parseJson(payload)
  if (!parsedPayload) {
    return null
  }

  if (parsedPayload.kind !== CODEX_SESSION_EVENT_KIND) {
    return null
  }

  const threadId =
    typeof parsedPayload.threadId === "string" ? parsedPayload.threadId : null
  const rolloutPath =
    typeof parsedPayload.rolloutPath === "string" ? parsedPayload.rolloutPath : null

  if (!threadId && !rolloutPath) {
    return null
  }

  return {
    threadId,
    rolloutPath,
  }
}

async function resolveRolloutPath(reference: CodexSessionReference) {
  if (reference.rolloutPath) {
    return {
      threadId: reference.threadId,
      rolloutPath: reference.rolloutPath,
      cwd: null,
    }
  }

  if (!reference.threadId) {
    return null
  }

  return lookupCodexThread(reference.threadId)
}

function extractSessionCwd(line: Record<string, unknown>) {
  if (line.type !== "session_meta") {
    return null
  }

  const payload = line.payload
  if (!isRecord(payload)) {
    return null
  }

  return typeof payload.cwd === "string" ? payload.cwd : null
}

export async function readTaskConversation(args: {
  taskId: string
  projectPath: string
  taskCreatedAt?: string | null
  taskPrompt?: string | null
  limit?: number
}): Promise<TaskConversationResult> {
  const eventLimit = SESSION_EVENT_SCAN_LIMIT
  const conversationLimit = normalizeConversationLimit(args.limit)
  const taskEvents = await listTaskEvents({
    taskId: args.taskId,
    limit: eventLimit,
    afterSequence: 0,
  })

  let sessionReference: CodexSessionReference | null = null
  for (const event of taskEvents) {
    if (event.type !== "system") {
      continue
    }

    const extracted = extractSessionReference(event.payload)
    if (!extracted) {
      continue
    }

    sessionReference = extracted
  }

  if (!sessionReference) {
    sessionReference = await fallbackSessionReference({
      projectPath: args.projectPath,
      taskCreatedAt: args.taskCreatedAt,
      taskPrompt: args.taskPrompt,
    })
  }

  if (!sessionReference) {
    return {
      taskId: args.taskId,
      threadId: null,
      rolloutPath: null,
      messages: [],
      truncated: false,
    }
  }

  const resolved = await resolveRolloutPath(sessionReference)
  if (!resolved) {
    return {
      taskId: args.taskId,
      threadId: sessionReference.threadId,
      rolloutPath: null,
      messages: [],
      truncated: false,
    }
  }

  const effectiveThreadId = resolved.threadId ?? sessionReference.threadId
  const absoluteRolloutPath = path.resolve(resolved.rolloutPath)
  if (!isPathInsideRoot(CODEX_SESSIONS_DIRECTORY, absoluteRolloutPath)) {
    return {
      taskId: args.taskId,
      threadId: effectiveThreadId,
      rolloutPath: null,
      messages: [],
      truncated: false,
    }
  }

  let rolloutContent = ""
  try {
    rolloutContent = await readFile(absoluteRolloutPath, "utf8")
  } catch {
    return {
      taskId: args.taskId,
      threadId: effectiveThreadId,
      rolloutPath: absoluteRolloutPath,
      messages: [],
      truncated: false,
    }
  }

  const lines = rolloutContent.split(/\r?\n/)
  const messages: TaskConversationMessage[] = []
  let sessionCwd = resolved.cwd
  let truncated = false

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index]?.trim()
    if (!rawLine) {
      continue
    }

    const parsedLine = parseJson(rawLine)
    if (!parsedLine) {
      continue
    }

    if (!sessionCwd) {
      sessionCwd = extractSessionCwd(parsedLine)
    }

    if (parsedLine.type !== "response_item") {
      continue
    }

    const payload = parsedLine.payload
    if (!isRecord(payload) || payload.type !== "message") {
      continue
    }

    const role = normalizeConversationRole(payload.role)
    if (!role) {
      continue
    }

    const content = extractMessageContent(payload.content)
    if (!content) {
      continue
    }

    const timestamp =
      typeof parsedLine.timestamp === "string" ? parsedLine.timestamp : null

    messages.push({
      id:
        typeof payload.id === "string"
          ? payload.id
          : `${args.taskId}-${String(index)}`,
      role,
      content,
      timestamp,
    })

    if (messages.length > conversationLimit) {
      messages.shift()
      truncated = true
    }
  }

  if (sessionCwd) {
    const expectedProjectPath = path.resolve(args.projectPath)
    const sessionProjectPath = path.resolve(sessionCwd)
    if (!isPathInsideRoot(expectedProjectPath, sessionProjectPath)) {
      return {
        taskId: args.taskId,
        threadId: effectiveThreadId,
        rolloutPath: absoluteRolloutPath,
        messages: [],
        truncated: false,
      }
    }
  }

  return {
    taskId: args.taskId,
    threadId: effectiveThreadId,
    rolloutPath: absoluteRolloutPath,
    messages,
    truncated,
  }
}
