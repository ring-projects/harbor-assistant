import { fstatSync } from "node:fs"

const STRIPPED_CHILD_ENV_KEYS = [
  "CODEX_MANAGED_BY_NPM",
  "CODEX_SANDBOX",
  "CODEX_SANDBOX_NETWORK_DISABLED",
  "CODEX_THREAD_ID",
] as const

const DIAGNOSTIC_ENV_KEYS = [
  "CODEX_MANAGED_BY_NPM",
  "CODEX_SANDBOX",
  "CODEX_SANDBOX_NETWORK_DISABLED",
  "CODEX_THREAD_ID",
  "NODE_OPTIONS",
  "PNPM_HOME",
] as const

export function buildChildProcessEnv(overrides?: Record<string, string>) {
  const env: Record<string, string> = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  )

  for (const key of STRIPPED_CHILD_ENV_KEYS) {
    delete env[key]
  }

  Object.assign(env, overrides ?? {})
  return env
}

function summarizeHandle(handle: unknown) {
  if (typeof handle !== "object" || handle === null) {
    return {
      type: typeof handle,
      value: String(handle),
    }
  }

  const typedHandle = handle as {
    constructor?: { name?: unknown }
    fd?: unknown
    destroyed?: unknown
    readable?: unknown
    writable?: unknown
    pending?: unknown
    connecting?: unknown
    bytesRead?: unknown
    bytesWritten?: unknown
    localAddress?: unknown
    localPort?: unknown
    remoteAddress?: unknown
    remotePort?: unknown
    _idleTimeout?: unknown
    hasRef?: unknown
  }

  return {
    type:
      typedHandle.constructor &&
      typeof typedHandle.constructor.name === "string"
        ? typedHandle.constructor.name
        : "unknown",
    fd: typeof typedHandle.fd === "number" ? typedHandle.fd : null,
    destroyed:
      typeof typedHandle.destroyed === "boolean" ? typedHandle.destroyed : null,
    readable:
      typeof typedHandle.readable === "boolean" ? typedHandle.readable : null,
    writable:
      typeof typedHandle.writable === "boolean" ? typedHandle.writable : null,
    pending:
      typeof typedHandle.pending === "boolean" ? typedHandle.pending : null,
    connecting:
      typeof typedHandle.connecting === "boolean"
        ? typedHandle.connecting
        : null,
    bytesRead:
      typeof typedHandle.bytesRead === "number" ? typedHandle.bytesRead : null,
    bytesWritten:
      typeof typedHandle.bytesWritten === "number"
        ? typedHandle.bytesWritten
        : null,
    localAddress:
      typeof typedHandle.localAddress === "string"
        ? typedHandle.localAddress
        : null,
    localPort:
      typeof typedHandle.localPort === "number" ? typedHandle.localPort : null,
    remoteAddress:
      typeof typedHandle.remoteAddress === "string"
        ? typedHandle.remoteAddress
        : null,
    remotePort:
      typeof typedHandle.remotePort === "number"
        ? typedHandle.remotePort
        : null,
    idleTimeout:
      typeof typedHandle._idleTimeout === "number"
        ? typedHandle._idleTimeout
        : null,
    hasRef:
      typeof typedHandle.hasRef === "function"
        ? (() => {
            try {
              return Boolean(typedHandle.hasRef())
            } catch {
              return null
            }
          })()
        : null,
  }
}

function summarizeRequest(request: unknown) {
  if (typeof request !== "object" || request === null) {
    return {
      type: typeof request,
      value: String(request),
    }
  }

  const typedRequest = request as {
    constructor?: { name?: unknown }
    context?: unknown
    oncomplete?: unknown
  }

  return {
    type:
      typedRequest.constructor &&
      typeof typedRequest.constructor.name === "string"
        ? typedRequest.constructor.name
        : "unknown",
    hasContext: typedRequest.context != null,
    hasOnComplete: typeof typedRequest.oncomplete === "function",
  }
}

function getActiveHandleSummary() {
  const getHandles = (
    process as NodeJS.Process & {
      _getActiveHandles?: () => unknown[]
    }
  )._getActiveHandles

  if (typeof getHandles !== "function") {
    return null
  }

  const handles = getHandles()
  const counts = handles.reduce<Record<string, number>>((acc, handle) => {
    const summary = summarizeHandle(handle)
    const key = typeof summary.type === "string" ? summary.type : "unknown"
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  return {
    total: handles.length,
    counts,
    samples: handles.slice(0, 20).map((handle) => summarizeHandle(handle)),
  }
}

function getActiveRequestSummary() {
  const getRequests = (
    process as NodeJS.Process & {
      _getActiveRequests?: () => unknown[]
    }
  )._getActiveRequests

  if (typeof getRequests !== "function") {
    return null
  }

  const requests = getRequests()
  const counts = requests.reduce<Record<string, number>>((acc, request) => {
    const summary = summarizeRequest(request)
    const key = typeof summary.type === "string" ? summary.type : "unknown"
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  return {
    total: requests.length,
    counts,
    samples: requests.slice(0, 20).map((request) => summarizeRequest(request)),
  }
}

function inspectStreamFd(
  name: "stdin" | "stdout" | "stderr",
  stream: NodeJS.ReadStream | NodeJS.WriteStream | undefined,
) {
  const typedStream = stream as
    | {
        fd?: unknown
        isTTY?: unknown
        readable?: unknown
        writable?: unknown
        destroyed?: unknown
      }
    | undefined
  const fd = typeof typedStream?.fd === "number" ? typedStream.fd : null

  if (fd === null) {
    return {
      name,
      fd: null,
      hasStream: Boolean(stream),
      isTTY: Boolean(typedStream?.isTTY),
      readable:
        "readable" in (typedStream ?? {})
          ? Boolean(typedStream?.readable)
          : null,
      writable:
        "writable" in (typedStream ?? {})
          ? Boolean(typedStream?.writable)
          : null,
      destroyed:
        "destroyed" in (typedStream ?? {})
          ? Boolean(typedStream?.destroyed)
          : null,
      fstat: null,
    }
  }

  try {
    const stats = fstatSync(fd)
    return {
      name,
      fd,
      hasStream: true,
      isTTY: Boolean(typedStream?.isTTY),
      readable:
        "readable" in (typedStream ?? {})
          ? Boolean(typedStream?.readable)
          : null,
      writable:
        "writable" in (typedStream ?? {})
          ? Boolean(typedStream?.writable)
          : null,
      destroyed:
        "destroyed" in (typedStream ?? {})
          ? Boolean(typedStream?.destroyed)
          : null,
      fstat: {
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        isFIFO: stats.isFIFO(),
        isSocket: stats.isSocket(),
        isCharacterDevice: stats.isCharacterDevice(),
      },
    }
  } catch (error) {
    return {
      name,
      fd,
      hasStream: true,
      isTTY: Boolean(typedStream?.isTTY),
      readable:
        "readable" in (typedStream ?? {})
          ? Boolean(typedStream?.readable)
          : null,
      writable:
        "writable" in (typedStream ?? {})
          ? Boolean(typedStream?.writable)
          : null,
      destroyed:
        "destroyed" in (typedStream ?? {})
          ? Boolean(typedStream?.destroyed)
          : null,
      fstat: {
        error: String(error),
      },
    }
  }
}

export function getChildProcessSpawnDiagnostics() {
  const relevantEnv = Object.fromEntries(
    DIAGNOSTIC_ENV_KEYS.map((key) => [key, process.env[key]]).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  )

  return {
    pid: process.pid,
    ppid: process.ppid,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    argv0: process.argv0,
    execPath: process.execPath,
    stdio: [
      inspectStreamFd("stdin", process.stdin),
      inspectStreamFd("stdout", process.stdout),
      inspectStreamFd("stderr", process.stderr),
    ],
    activeHandles: getActiveHandleSummary(),
    activeRequests: getActiveRequestSummary(),
    env: relevantEnv,
  }
}

export function logChildProcessSpawnFailure(args: {
  scope: string
  command: string
  args: string[]
  cwd?: string
  error: unknown
}) {
  console.error(
    "[child-process:spawn-failed]",
    JSON.stringify(
      {
        scope: args.scope,
        command: args.command,
        args: args.args,
        cwd: args.cwd ?? null,
        error:
          typeof args.error === "object" && args.error !== null
            ? {
                name:
                  "name" in args.error && typeof args.error.name === "string"
                    ? args.error.name
                    : null,
                message:
                  "message" in args.error &&
                  typeof args.error.message === "string"
                    ? args.error.message
                    : String(args.error),
                code:
                  "code" in args.error && typeof args.error.code === "string"
                    ? args.error.code
                    : null,
                errno:
                  "errno" in args.error && typeof args.error.errno === "number"
                    ? args.error.errno
                    : null,
                syscall:
                  "syscall" in args.error &&
                  typeof args.error.syscall === "string"
                    ? args.error.syscall
                    : null,
              }
            : {
                message: String(args.error),
              },
        diagnostics: getChildProcessSpawnDiagnostics(),
      },
      null,
      2,
    ),
  )
}
