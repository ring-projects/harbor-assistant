import { readFile } from "node:fs/promises"

import { loadServiceConfig } from "../config"
import type { AgentInputItem } from "../lib/agents"
import { HARBOR_SESSION_COOKIE_NAME } from "../modules/auth"

type CliEnv = Record<string, string | undefined>

type CliWriter = (line: string) => void

type FetchLike = typeof fetch

type LoadConfigLike = (args?: { env?: CliEnv }) => Promise<{
  appBaseUrl: string
}>

type HarborAuthHeaders =
  | {
      authorization: string
      cookie?: never
    }
  | {
      cookie: string
      authorization?: never
    }

type ParsedArgs = {
  positionals: string[]
  flags: Map<string, string[]>
  booleans: Set<string>
}

type RunHarborCliOptions = {
  env?: CliEnv
  stdout?: CliWriter
  stderr?: CliWriter
  fetchImpl?: FetchLike
  loadConfig?: LoadConfigLike
}

class CliUsageError extends Error {}

function buildUsageText() {
  return [
    "Harbor CLI",
    "",
    "Commands:",
    "  harbor auth whoami",
    "  harbor auth delegate --scope <scope> --project <id> [--name <name>] [--ttl-seconds <seconds>]",
    "  harbor orchestration list --project <id> [--surface human-loop|schedule]",
    "  harbor orchestration create --project <id> [--title <title>] [--description <description>]",
    "  harbor orchestration bootstrap --project <id> --executor <executor> --model <model> --mode <mode> --effort <effort> [--prompt <prompt> | --item-text <text> --item-file <path> --item-image <path>] [--title <title>] [--description <description>] [--task-title <title>]",
    "  harbor orchestration update --id <orchestrationId> [--title <title>] [--description <description>]",
    "  harbor orchestration schedule set --id <orchestrationId> --cron <expr> --executor <executor> --model <model> --mode <mode> --effort <effort> --prompt <prompt> [--timezone <tz>] [--title <title>] [--disable]",
    "  harbor orchestration tasks list --id <orchestrationId> [--limit <n>] [--include-archived]",
    "  harbor orchestration task create --id <orchestrationId> --executor <executor> --model <model> --mode <mode> --effort <effort> [--prompt <prompt> | --item-text <text> --item-file <path> --item-image <path>] [--task-title <title>]",
    "  harbor task get --id <taskId>",
    "  harbor task events --id <taskId> [--after-sequence <n>] [--limit <n>]",
    "  harbor task title set --id <taskId> --title <title>",
    "  harbor task resume --id <taskId> --prompt <prompt> [--model <model>] [--effort <effort>]",
    "  harbor task cancel --id <taskId> [--reason <reason>]",
    "  harbor task archive --id <taskId>",
    "  harbor task delete --id <taskId>",
    "  harbor git summary --project <id>",
    "  harbor git branches --project <id>",
    "  harbor git diff --project <id>",
    "  harbor git checkout --project <id> --branch <name>",
    "  harbor git branch create --project <id> --branch <name> [--from <ref>] [--checkout]",
    "  harbor files list --project <id> [--path <path>] [--limit <n>] [--include-hidden]",
    "  harbor files stat --project <id> --path <path>",
    "  harbor files read --project <id> --path <path>",
    "  harbor files write --project <id> --path <path> [--content <text> | --content-file <local-path>] [--create-parents]",
    "  harbor files mkdir --project <id> --path <path> [--recursive]",
    "",
    "Output flags:",
    "  --json-pretty",
    "  --raw-field <path>",
    "  --raw-content",
    "  --exit-on-empty",
    "",
    "Auth env:",
    "  HARBOR_TOKEN",
    "  HARBOR_COOKIE",
    `  ${HARBOR_SESSION_COOKIE_NAME.toUpperCase()}_TOKEN`,
    "",
    "Base URL env:",
    "  HARBOR_SERVICE_BASE_URL",
    "  HARBOR_BASE_URL",
  ].join("\n")
}

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = []
  const flags = new Map<string, string[]>()
  const booleans = new Set<string>()

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith("--") || token === "--") {
      positionals.push(token)
      continue
    }

    const equalsIndex = token.indexOf("=")
    if (equalsIndex >= 0) {
      const name = token.slice(2, equalsIndex)
      const value = token.slice(equalsIndex + 1)
      flags.set(name, [...(flags.get(name) ?? []), value])
      continue
    }

    const name = token.slice(2)
    const nextToken = argv[index + 1]
    if (nextToken !== undefined && !nextToken.startsWith("--")) {
      flags.set(name, [...(flags.get(name) ?? []), nextToken])
      index += 1
      continue
    }

    booleans.add(name)
  }

  return {
    positionals,
    flags,
    booleans,
  }
}

function getFlagValues(parsed: ParsedArgs, names: string[]) {
  return names.flatMap((name) => parsed.flags.get(name) ?? [])
}

function getOptionalFlag(parsed: ParsedArgs, names: string[]) {
  const value = getFlagValues(parsed, names).at(-1)
  return value === undefined ? undefined : value
}

function requireFlag(parsed: ParsedArgs, names: string[], label: string) {
  const value = getOptionalFlag(parsed, names)?.trim()
  if (!value) {
    throw new CliUsageError(`Missing required option ${label}.`)
  }

  return value
}

function hasBooleanFlag(parsed: ParsedArgs, names: string[]) {
  return names.some((name) => parsed.booleans.has(name))
}

function getMultiFlag(parsed: ParsedArgs, names: string[]) {
  return getFlagValues(parsed, names)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean)
}

function getOptionalIntegerFlag(parsed: ParsedArgs, names: string[]) {
  const raw = getOptionalFlag(parsed, names)
  if (raw === undefined) {
    return undefined
  }

  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value)) {
    throw new CliUsageError(`Invalid integer option --${names[0]}.`)
  }

  return value
}

async function resolveFileWriteContent(parsed: ParsedArgs) {
  const inlineContent = getOptionalFlag(parsed, ["content"])
  const contentFilePath = getOptionalFlag(parsed, ["content-file"])

  if (inlineContent !== undefined && contentFilePath !== undefined) {
    throw new CliUsageError("Use either --content or --content-file, not both.")
  }

  if (contentFilePath !== undefined) {
    return readFile(contentFilePath, "utf8")
  }

  if (inlineContent !== undefined) {
    return inlineContent
  }

  throw new CliUsageError(
    "Missing required option --content or --content-file.",
  )
}

function buildAgentInputItems(parsed: ParsedArgs): AgentInputItem[] {
  const items: AgentInputItem[] = []

  for (const text of getFlagValues(parsed, ["item-text"])) {
    const normalized = text.trim()
    if (normalized) {
      items.push({
        type: "text",
        text: normalized,
      })
    }
  }

  for (const filePath of getFlagValues(parsed, ["item-file"])) {
    const normalized = filePath.trim()
    if (normalized) {
      items.push({
        type: "local_file",
        path: normalized,
      })
    }
  }

  for (const imagePath of getFlagValues(parsed, ["item-image"])) {
    const normalized = imagePath.trim()
    if (normalized) {
      items.push({
        type: "local_image",
        path: normalized,
      })
    }
  }

  return items
}

function buildTaskCreationPayload(parsed: ParsedArgs) {
  const prompt = getOptionalFlag(parsed, ["prompt"])
  const items = buildAgentInputItems(parsed)

  if (!prompt?.trim() && items.length === 0) {
    throw new CliUsageError(
      "Missing task input. Provide --prompt or at least one of --item-text, --item-file, or --item-image.",
    )
  }

  return {
    prompt: prompt?.trim() || undefined,
    items: items.length > 0 ? items : undefined,
    title: getOptionalFlag(parsed, ["task-title", "task"]),
    executor: requireFlag(parsed, ["executor"], "--executor"),
    model: requireFlag(parsed, ["model"], "--model"),
    executionMode: requireFlag(parsed, ["mode", "execution-mode"], "--mode"),
    effort: requireFlag(parsed, ["effort"], "--effort"),
  }
}

function getValueAtPath(value: unknown, fieldPath: string) {
  const normalizedPath = fieldPath.trim()
  if (!normalizedPath) {
    throw new CliUsageError("Missing value for --raw-field.")
  }

  return normalizedPath.split(".").reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) {
      return undefined
    }

    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10)
      return Number.isInteger(index) ? current[index] : undefined
    }

    if (typeof current === "object") {
      return (current as Record<string, unknown>)[segment]
    }

    return undefined
  }, value)
}

function findRawContent(value: unknown) {
  const candidates = ["file.content", "content"]
  for (const candidate of candidates) {
    const resolved = getValueAtPath(value, candidate)
    if (resolved !== undefined && resolved !== null) {
      return resolved
    }
  }

  return undefined
}

function isEmptyOutputValue(value: unknown) {
  if (value === null || value === undefined) {
    return true
  }

  if (typeof value === "string") {
    return value.length === 0
  }

  if (Array.isArray(value)) {
    return value.length === 0
  }

  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length === 0
  }

  return false
}

function serializeOutputValue(value: unknown, pretty: boolean) {
  if (typeof value === "string") {
    return value
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return String(value)
  }

  return JSON.stringify(value, null, pretty ? 2 : undefined)
}

function renderCommandResult(args: { parsed: ParsedArgs; result: unknown }) {
  const pretty = hasBooleanFlag(args.parsed, ["json-pretty"])
  const rawField = getOptionalFlag(args.parsed, ["raw-field"])
  const rawContent = hasBooleanFlag(args.parsed, ["raw-content"])

  if (rawField && rawContent) {
    throw new CliUsageError(
      "Use either --raw-field or --raw-content, not both.",
    )
  }

  const selectedValue = rawField
    ? getValueAtPath(args.result, rawField)
    : rawContent
      ? findRawContent(args.result)
      : args.result

  return {
    value: selectedValue,
    text: serializeOutputValue(
      selectedValue,
      pretty || (!rawField && !rawContent),
    ),
  }
}

export function normalizeHarborApiBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "")
  if (!trimmed) {
    throw new CliUsageError("Missing Harbor service base URL.")
  }

  return /\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/v1`
}

export async function resolveHarborApiBaseUrl(args?: {
  env?: CliEnv
  loadConfig?: LoadConfigLike
}) {
  const env = args?.env ?? process.env
  const explicitBaseUrl =
    env.HARBOR_SERVICE_BASE_URL?.trim() || env.HARBOR_BASE_URL?.trim()
  if (explicitBaseUrl) {
    return normalizeHarborApiBaseUrl(explicitBaseUrl)
  }

  const loadConfig = args?.loadConfig ?? loadServiceConfig
  try {
    const config = await loadConfig({ env })
    return normalizeHarborApiBaseUrl(config.appBaseUrl)
  } catch {
    return "http://127.0.0.1:3400/v1"
  }
}

export function resolveHarborAuthHeaders(env: CliEnv) {
  const token = env.HARBOR_TOKEN?.trim()
  if (token) {
    return {
      authorization: `Bearer ${token}`,
    }
  }

  const cookieHeader = env.HARBOR_COOKIE?.trim()
  if (cookieHeader) {
    return {
      cookie: cookieHeader,
    }
  }

  const sessionCookie = env.HARBOR_SESSION_COOKIE?.trim()
  if (sessionCookie) {
    return {
      cookie: sessionCookie.includes("=")
        ? sessionCookie
        : `${HARBOR_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionCookie)}`,
    }
  }

  const sessionToken =
    env.HARBOR_SESSION_TOKEN?.trim() ??
    env[`${HARBOR_SESSION_COOKIE_NAME.toUpperCase()}_TOKEN`]?.trim()
  if (sessionToken) {
    return {
      cookie: `${HARBOR_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
    }
  }

  throw new CliUsageError(
    "Missing Harbor auth. Set HARBOR_TOKEN, HARBOR_COOKIE, HARBOR_SESSION_COOKIE, or HARBOR_SESSION_TOKEN.",
  )
}

function buildApiUrl(
  baseUrl: string,
  pathname: string,
  query?: Record<string, string>,
) {
  const url = new URL(pathname.replace(/^\//, ""), `${baseUrl}/`)
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

async function readJsonResponse(response: Response) {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function extractApiErrorMessage(status: number, payload: unknown) {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>
    const message =
      typeof record.message === "string"
        ? record.message
        : typeof record.error === "string"
          ? record.error
          : null
    if (message) {
      return `Harbor API request failed (${status}): ${message}`
    }
  }

  if (typeof payload === "string" && payload.trim()) {
    return `Harbor API request failed (${status}): ${payload.trim()}`
  }

  return `Harbor API request failed (${status}).`
}

async function requestJson(args: {
  fetchImpl: FetchLike
  baseUrl: string
  authHeaders: HarborAuthHeaders
  method: string
  pathname: string
  query?: Record<string, string>
  body?: unknown
}) {
  const headers: Record<string, string> = {
    accept: "application/json",
  }
  if ("authorization" in args.authHeaders && args.authHeaders.authorization) {
    headers.authorization = args.authHeaders.authorization
  }
  if ("cookie" in args.authHeaders && args.authHeaders.cookie) {
    headers.cookie = args.authHeaders.cookie
  }
  if (args.body !== undefined) {
    headers["content-type"] = "application/json"
  }

  const response = await args.fetchImpl(
    buildApiUrl(args.baseUrl, args.pathname, args.query),
    {
      method: args.method,
      headers,
      body: args.body === undefined ? undefined : JSON.stringify(args.body),
    },
  )

  const payload = await readJsonResponse(response)
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(response.status, payload))
  }

  return payload
}

async function executeCommand(args: {
  parsed: ParsedArgs
  baseUrl: string
  authHeaders: HarborAuthHeaders
  fetchImpl: FetchLike
}) {
  const commandKey = args.parsed.positionals.join(" ")

  if (commandKey === "auth whoami") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "GET",
      pathname: "/auth/session",
    })
  }

  if (commandKey === "auth delegate") {
    const scopes = getMultiFlag(args.parsed, ["scope", "scopes"])
    if (scopes.length === 0) {
      throw new CliUsageError("Missing required option --scope.")
    }

    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "POST",
      pathname: "/auth/agent-tokens/delegate",
      body: {
        name: getOptionalFlag(args.parsed, ["name"]),
        ttlSeconds: getOptionalIntegerFlag(args.parsed, ["ttl-seconds", "ttl"]),
        scopes,
        projectId: getOptionalFlag(args.parsed, ["project", "project-id"]),
        orchestrationId: getOptionalFlag(args.parsed, [
          "orchestration",
          "orchestration-id",
        ]),
        taskId: getOptionalFlag(args.parsed, ["task", "task-id"]),
      },
    })
  }

  if (commandKey === "task get") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "GET",
      pathname: `/tasks/${requireFlag(args.parsed, ["id", "task-id"], "--id")}`,
    })
  }

  if (commandKey === "task events") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "GET",
      pathname: `/tasks/${requireFlag(args.parsed, ["id", "task-id"], "--id")}/events`,
      query: (() => {
        const afterSequence = getOptionalIntegerFlag(args.parsed, [
          "after-sequence",
        ])
        const limit = getOptionalIntegerFlag(args.parsed, ["limit"])
        const query: Record<string, string> = {}
        if (afterSequence !== undefined) {
          query.afterSequence = String(afterSequence)
        }
        if (limit !== undefined) {
          query.limit = String(limit)
        }
        return Object.keys(query).length > 0 ? query : undefined
      })(),
    })
  }

  if (commandKey === "task title set") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "PUT",
      pathname: `/tasks/${requireFlag(args.parsed, ["id", "task-id"], "--id")}/title`,
      body: {
        title: requireFlag(args.parsed, ["title"], "--title"),
      },
    })
  }

  if (commandKey === "task resume") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "POST",
      pathname: `/tasks/${requireFlag(args.parsed, ["id", "task-id"], "--id")}/resume`,
      body: {
        prompt: requireFlag(args.parsed, ["prompt"], "--prompt"),
        model: getOptionalFlag(args.parsed, ["model"]),
        effort: getOptionalFlag(args.parsed, ["effort"]),
      },
    })
  }

  if (commandKey === "task cancel") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "POST",
      pathname: `/tasks/${requireFlag(args.parsed, ["id", "task-id"], "--id")}/cancel`,
      body: {
        reason: getOptionalFlag(args.parsed, ["reason"]),
      },
    })
  }

  if (commandKey === "task archive") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "POST",
      pathname: `/tasks/${requireFlag(args.parsed, ["id", "task-id"], "--id")}/archive`,
    })
  }

  if (commandKey === "task delete") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "DELETE",
      pathname: `/tasks/${requireFlag(args.parsed, ["id", "task-id"], "--id")}`,
    })
  }

  if (commandKey === "orchestration list") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "GET",
      pathname: `/projects/${requireFlag(args.parsed, ["project", "project-id"], "--project")}/orchestrations`,
      query: (() => {
        const surface = getOptionalFlag(args.parsed, ["surface"])
        return surface ? { surface } : undefined
      })(),
    })
  }

  if (commandKey === "orchestration create") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "POST",
      pathname: "/orchestrations",
      body: {
        projectId: requireFlag(
          args.parsed,
          ["project", "project-id"],
          "--project",
        ),
        title: getOptionalFlag(args.parsed, ["title"]),
        description: getOptionalFlag(args.parsed, ["description"]),
      },
    })
  }

  if (commandKey === "orchestration bootstrap") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "POST",
      pathname: "/orchestrations/bootstrap",
      body: {
        projectId: requireFlag(
          args.parsed,
          ["project", "project-id"],
          "--project",
        ),
        orchestration: {
          title: getOptionalFlag(args.parsed, ["title"]),
          description: getOptionalFlag(args.parsed, ["description"]),
        },
        initialTask: buildTaskCreationPayload(args.parsed),
      },
    })
  }

  if (commandKey === "orchestration update") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "PATCH",
      pathname: `/orchestrations/${requireFlag(args.parsed, ["id", "orchestration-id"], "--id")}`,
      body: {
        title: getOptionalFlag(args.parsed, ["title"]),
        description: getOptionalFlag(args.parsed, ["description"]),
      },
    })
  }

  if (commandKey === "orchestration tasks list") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "GET",
      pathname: `/orchestrations/${requireFlag(args.parsed, ["id", "orchestration-id"], "--id")}/tasks`,
      query: (() => {
        const limit = getOptionalIntegerFlag(args.parsed, ["limit"])
        const query: Record<string, string> = {}
        if (limit !== undefined) {
          query.limit = String(limit)
        }
        if (hasBooleanFlag(args.parsed, ["include-archived"])) {
          query.includeArchived = "true"
        }
        return Object.keys(query).length > 0 ? query : undefined
      })(),
    })
  }

  if (commandKey === "orchestration task create") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "POST",
      pathname: `/orchestrations/${requireFlag(args.parsed, ["id", "orchestration-id"], "--id")}/tasks`,
      body: buildTaskCreationPayload(args.parsed),
    })
  }

  if (commandKey === "orchestration schedule set") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "PUT",
      pathname: `/orchestrations/${requireFlag(args.parsed, ["id", "orchestration-id"], "--id")}/schedule`,
      body: {
        enabled: !hasBooleanFlag(args.parsed, ["disable", "disabled"]),
        cronExpression: requireFlag(args.parsed, ["cron"], "--cron"),
        timezone: getOptionalFlag(args.parsed, ["timezone"]),
        concurrencyPolicy: "skip",
        taskTemplate: {
          title: getOptionalFlag(args.parsed, ["title"]),
          prompt: requireFlag(args.parsed, ["prompt"], "--prompt"),
          executor: requireFlag(args.parsed, ["executor"], "--executor"),
          model: requireFlag(args.parsed, ["model"], "--model"),
          executionMode: requireFlag(
            args.parsed,
            ["mode", "execution-mode"],
            "--mode",
          ),
          effort: requireFlag(args.parsed, ["effort"], "--effort"),
        },
      },
    })
  }

  if (commandKey === "git summary") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "GET",
      pathname: `/projects/${requireFlag(args.parsed, ["project", "project-id"], "--project")}/git`,
    })
  }

  if (commandKey === "git branches") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "GET",
      pathname: `/projects/${requireFlag(args.parsed, ["project", "project-id"], "--project")}/git/branches`,
    })
  }

  if (commandKey === "git diff") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "GET",
      pathname: `/projects/${requireFlag(args.parsed, ["project", "project-id"], "--project")}/git/diff`,
    })
  }

  if (commandKey === "git checkout") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "POST",
      pathname: `/projects/${requireFlag(args.parsed, ["project", "project-id"], "--project")}/git/checkout`,
      body: {
        branchName: requireFlag(
          args.parsed,
          ["branch", "branch-name"],
          "--branch",
        ),
      },
    })
  }

  if (commandKey === "git branch create") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "POST",
      pathname: `/projects/${requireFlag(args.parsed, ["project", "project-id"], "--project")}/git/branches`,
      body: {
        branchName: requireFlag(
          args.parsed,
          ["branch", "branch-name"],
          "--branch",
        ),
        checkout: hasBooleanFlag(args.parsed, ["checkout"]),
        fromRef: getOptionalFlag(args.parsed, ["from", "from-ref"]),
      },
    })
  }

  if (commandKey === "files list") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "POST",
      pathname: `/projects/${requireFlag(args.parsed, ["project", "project-id"], "--project")}/files/list`,
      body: {
        path: getOptionalFlag(args.parsed, ["path"]),
        limit: getOptionalIntegerFlag(args.parsed, ["limit"]),
        includeHidden: hasBooleanFlag(args.parsed, ["include-hidden"]),
      },
    })
  }

  if (commandKey === "files stat") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "GET",
      pathname: `/projects/${requireFlag(args.parsed, ["project", "project-id"], "--project")}/files/stat`,
      query: {
        path: requireFlag(args.parsed, ["path"], "--path"),
      },
    })
  }

  if (commandKey === "files read") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "GET",
      pathname: `/projects/${requireFlag(args.parsed, ["project", "project-id"], "--project")}/files/text`,
      query: {
        path: requireFlag(args.parsed, ["path"], "--path"),
      },
    })
  }

  if (commandKey === "files write") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "POST",
      pathname: `/projects/${requireFlag(args.parsed, ["project", "project-id"], "--project")}/files/text`,
      body: {
        path: requireFlag(args.parsed, ["path"], "--path"),
        content: await resolveFileWriteContent(args.parsed),
        createParents: hasBooleanFlag(args.parsed, ["create-parents"]),
      },
    })
  }

  if (commandKey === "files mkdir") {
    return requestJson({
      fetchImpl: args.fetchImpl,
      baseUrl: args.baseUrl,
      authHeaders: args.authHeaders,
      method: "POST",
      pathname: `/projects/${requireFlag(args.parsed, ["project", "project-id"], "--project")}/files/directories`,
      body: {
        path: requireFlag(args.parsed, ["path"], "--path"),
        recursive: hasBooleanFlag(args.parsed, ["recursive"]),
      },
    })
  }

  throw new CliUsageError(`Unsupported command: ${commandKey || "<empty>"}.`)
}

export async function runHarborCli(
  argv: string[],
  options?: RunHarborCliOptions,
) {
  const stdout = options?.stdout ?? ((line: string) => console.log(line))
  const stderr = options?.stderr ?? ((line: string) => console.error(line))
  const env = options?.env ?? process.env
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch.bind(globalThis)

  if (argv.length === 0 || argv.includes("--help") || argv[0] === "help") {
    stdout(buildUsageText())
    return 0
  }

  try {
    const parsed = parseArgs(argv)
    const baseUrl = await resolveHarborApiBaseUrl({
      env,
      loadConfig: options?.loadConfig,
    })
    const authHeaders = resolveHarborAuthHeaders(env)
    const result = await executeCommand({
      parsed,
      baseUrl,
      authHeaders,
      fetchImpl,
    })

    const rendered = renderCommandResult({
      parsed,
      result,
    })

    if (isEmptyOutputValue(rendered.value)) {
      if (hasBooleanFlag(parsed, ["exit-on-empty"])) {
        stderr("Selected output is empty.")
        return 1
      }

      return 0
    }

    stdout(rendered.text)
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    stderr(message)
    return 1
  }
}
