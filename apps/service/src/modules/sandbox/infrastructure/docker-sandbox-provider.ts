import { randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { buildChildProcessEnv } from "../../../lib/process-env"
import type {
  SandboxCommand,
  SandboxCommandHandle,
  SandboxFileInput,
  SandboxProvisioningPort,
} from "../application/sandbox-provider"

type SbxCliResult = {
  exitCode: number | null
  stdout: string
  stderr: string
}

type SbxCliRunner = (args: string[], cwd?: string) => Promise<SbxCliResult>
type DockerSandboxLogger = {
  info?: (message: string) => void
  warn?: (message: string) => void
  error?: (message: string) => void
}

type SnapshotMetadata = {
  templateTag: string
}

type SandboxPortRecord = {
  sandboxPort: number | null
  hostPort: string | null
  hostIp: string | null
  protocol: string | null
}

const SBX_CLI_NAME = "sbx"
const DEFAULT_SBX_AGENT = "shell"
export const DOCKER_SANDBOX_REPO_ROOT = getRepositoryRootDirectory()

function getServiceRootDirectory() {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  )
}

function getRepositoryRootDirectory() {
  return path.resolve(getServiceRootDirectory(), "../..")
}

function summarizeCliResult(result: SbxCliResult) {
  const detail = result.stderr || result.stdout
  if (detail.trim().length > 0) {
    return detail.replace(/\s+/g, " ").trim()
  }

  return `exit=${result.exitCode ?? "unknown"}`
}

function readCommandError(error: unknown) {
  if (error instanceof Error) {
    return error.message.trim() || "Sandbox command failed."
  }

  return String(error).trim() || "Sandbox command failed."
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

async function runSbxCli(args: string[], cwd?: string): Promise<SbxCliResult> {
  return new Promise((resolve) => {
    let childProcess

    try {
      childProcess = spawn(SBX_CLI_NAME, args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: buildChildProcessEnv(),
        windowsHide: true,
      })
    } catch (error) {
      resolve({
        exitCode: null,
        stdout: "",
        stderr: readCommandError(error),
      })
      return
    }

    let stdout = ""
    let stderr = ""
    let settled = false

    function settle(result: SbxCliResult) {
      if (settled) {
        return
      }

      settled = true
      resolve(result)
    }

    childProcess.stdout?.on("data", (chunk) => {
      stdout += chunk.toString()
    })

    childProcess.stderr?.on("data", (chunk) => {
      stderr += chunk.toString()
    })

    childProcess.on("error", (error) => {
      settle({
        exitCode: null,
        stdout,
        stderr: [stderr, readCommandError(error)]
          .filter(Boolean)
          .join("\n")
          .trim(),
      })
    })

    childProcess.on("close", (exitCode) => {
      settle({
        exitCode,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      })
    })
  })
}

async function runGit(args: string[], cwd?: string): Promise<SbxCliResult> {
  return new Promise((resolve) => {
    let childProcess

    try {
      childProcess = spawn("git", args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: buildChildProcessEnv(),
        windowsHide: true,
      })
    } catch (error) {
      resolve({
        exitCode: null,
        stdout: "",
        stderr: readCommandError(error),
      })
      return
    }

    let stdout = ""
    let stderr = ""
    let settled = false

    function settle(result: SbxCliResult) {
      if (settled) {
        return
      }

      settled = true
      resolve(result)
    }

    childProcess.stdout?.on("data", (chunk) => {
      stdout += chunk.toString()
    })

    childProcess.stderr?.on("data", (chunk) => {
      stderr += chunk.toString()
    })

    childProcess.on("error", (error) => {
      settle({
        exitCode: null,
        stdout,
        stderr: [stderr, readCommandError(error)]
          .filter(Boolean)
          .join("\n")
          .trim(),
      })
    })

    childProcess.on("close", (exitCode) => {
      settle({
        exitCode,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      })
    })
  })
}

export async function logDockerSandboxReadiness(input: {
  rootDirectory: string
  logger?: DockerSandboxLogger
  runCli?: SbxCliRunner
}) {
  const runCli = input.runCli ?? runSbxCli
  const sbxVersion = await runCli(["version"])
  if (sbxVersion.exitCode === 0) {
    input.logger?.info?.(
      `[harbor:sandbox] sbx cli ready version=${sbxVersion.stdout.trim() || "unknown"}`,
    )
  } else {
    input.logger?.warn?.(
      `[harbor:sandbox] sbx cli check failed ${summarizeCliResult(sbxVersion)}`,
    )
  }

  const listedSandboxes = await runCli(["ls", "--json"])
  if (listedSandboxes.exitCode === 0) {
    input.logger?.info?.(
      `[harbor:sandbox] docker sandboxes runtime ready root=${input.rootDirectory} agent=${DEFAULT_SBX_AGENT}`,
    )
    return
  }

  input.logger?.warn?.(
    `[harbor:sandbox] docker sandboxes runtime check failed ${summarizeCliResult(listedSandboxes)}`,
  )
}

function drainCompletedLines(buffer: string) {
  const segments = buffer.split(/\r?\n/)
  const trailing = buffer.endsWith("\n") ? "" : (segments.pop() ?? "")

  return {
    lines: segments
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0),
    trailing,
  }
}

class AsyncLineQueue {
  private readonly buffered: string[] = []
  private readonly waiters: Array<(value: IteratorResult<string>) => void> = []
  private done = false

  push(line: string) {
    if (!line) {
      return
    }

    if (this.waiters.length > 0) {
      const waiter = this.waiters.shift()
      waiter?.({
        value: line,
        done: false,
      })
      return
    }

    this.buffered.push(line)
  }

  close() {
    if (this.done) {
      return
    }

    this.done = true
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift()
      waiter?.({
        value: undefined,
        done: true,
      })
    }
  }

  async next(): Promise<IteratorResult<string>> {
    if (this.buffered.length > 0) {
      const line = this.buffered.shift()
      return {
        value: line ?? "",
        done: false,
      }
    }

    if (this.done) {
      return {
        value: undefined,
        done: true,
      }
    }

    return new Promise((resolve) => {
      this.waiters.push(resolve)
    })
  }
}

class DockerSandboxCommandHandle implements SandboxCommandHandle {
  constructor(
    readonly providerCommandId: string,
    private readonly childProcess: ReturnType<typeof spawn>,
    private readonly logQueue: AsyncLineQueue,
    private readonly waitResult: Promise<{ exitCode: number | null }>,
  ) {}

  async *logs() {
    while (true) {
      const next = await this.logQueue.next()
      if (next.done) {
        return
      }

      yield next.value
    }
  }

  wait() {
    return this.waitResult
  }

  async kill() {
    this.childProcess.kill("SIGTERM")
  }
}

async function ensureDirectorySnapshot(input: {
  sourcePath: string
  targetPath: string
}) {
  await cp(input.sourcePath, input.targetPath, {
    recursive: true,
    force: true,
  })
}

async function isGitRepository(targetPath: string) {
  const result = await runGit(
    ["rev-parse", "--is-inside-work-tree"],
    targetPath,
  )
  return result.exitCode === 0 && result.stdout.trim() === "true"
}

async function ensureGitCheckoutFromDirectory(input: {
  sourcePath: string
  targetPath: string
}) {
  const cloned = await runGit([
    "clone",
    "--quiet",
    input.sourcePath,
    input.targetPath,
  ])
  if (cloned.exitCode !== 0) {
    throw new Error(
      cloned.stderr || "Failed to clone repository into sandbox workspace.",
    )
  }
}

async function ensureGitCheckoutFromRemote(input: {
  repositoryUrl: string
  ref: string | null
  targetPath: string
}) {
  const cloned = await runGit([
    "clone",
    "--quiet",
    input.repositoryUrl,
    input.targetPath,
  ])
  if (cloned.exitCode !== 0) {
    throw new Error(
      cloned.stderr || "Failed to clone repository into sandbox workspace.",
    )
  }

  if (!input.ref?.trim()) {
    return
  }

  const checkedOut = await runGit(
    ["checkout", "--quiet", input.ref.trim()],
    input.targetPath,
  )
  if (checkedOut.exitCode !== 0) {
    throw new Error(
      checkedOut.stderr ||
        `Failed to checkout ref "${input.ref}" in sandbox workspace.`,
    )
  }
}

function buildTemplateTag(providerSnapshotId: string) {
  return `harbor-sbx-template:${providerSnapshotId.replace(/[^a-zA-Z0-9_.-]/g, "-")}`
}

function toSnapshotDirectory(
  rootDirectory: string,
  providerSnapshotId: string,
) {
  return path.join(rootDirectory, ".snapshots", providerSnapshotId)
}

function toSnapshotWorkspaceDirectory(
  rootDirectory: string,
  providerSnapshotId: string,
) {
  return path.join(
    toSnapshotDirectory(rootDirectory, providerSnapshotId),
    "workspace",
  )
}

function toSnapshotMetadataPath(
  rootDirectory: string,
  providerSnapshotId: string,
) {
  return path.join(
    toSnapshotDirectory(rootDirectory, providerSnapshotId),
    "metadata.json",
  )
}

function toSandboxDirectory(rootDirectory: string, providerSandboxId: string) {
  return path.join(rootDirectory, providerSandboxId)
}

function toWorkspaceDirectory(
  rootDirectory: string,
  providerSandboxId: string,
) {
  return path.join(
    toSandboxDirectory(rootDirectory, providerSandboxId),
    "workspace",
  )
}

async function readSnapshotMetadata(
  rootDirectory: string,
  providerSnapshotId: string,
): Promise<SnapshotMetadata> {
  const metadataPath = toSnapshotMetadataPath(rootDirectory, providerSnapshotId)
  if (!(await pathExists(metadataPath))) {
    throw new Error(`Sandbox snapshot metadata was not found: ${metadataPath}`)
  }

  const raw = await readFile(metadataPath, "utf8")
  const parsed = JSON.parse(raw) as Partial<SnapshotMetadata>
  const templateTag = parsed.templateTag?.trim()
  if (!templateTag) {
    throw new Error(`Sandbox snapshot metadata is invalid: ${metadataPath}`)
  }

  return {
    templateTag,
  }
}

function normalizePortValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    const parsed = Number.parseInt(trimmed, 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizeStringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function parseSandboxPortRecords(stdout: string) {
  if (!stdout.trim()) {
    return [] satisfies SandboxPortRecord[]
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    return [] satisfies SandboxPortRecord[]
  }

  if (!Array.isArray(parsed)) {
    return [] satisfies SandboxPortRecord[]
  }

  return parsed
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null
      }

      const record = item as Record<string, unknown>
      return {
        sandboxPort:
          normalizePortValue(record.sandboxPort) ??
          normalizePortValue(record.sandbox_port) ??
          normalizePortValue(record.port),
        hostPort:
          normalizeStringValue(record.hostPort) ??
          normalizeStringValue(record.host_port),
        hostIp:
          normalizeStringValue(record.hostIp) ??
          normalizeStringValue(record.host_ip),
        protocol: normalizeStringValue(record.protocol),
      } satisfies SandboxPortRecord
    })
    .filter((item): item is SandboxPortRecord => item !== null)
}

async function listPublishedPorts(
  runCli: SbxCliRunner,
  providerSandboxId: string,
): Promise<SandboxPortRecord[]> {
  const listed = await runCli(["ports", providerSandboxId, "--json"])
  if (listed.exitCode !== 0) {
    throw new Error(listed.stderr || "Failed to list sandbox ports.")
  }

  return parseSandboxPortRecords(listed.stdout)
}

function resolveContainerWorkingDirectory(input: {
  workspaceDirectory: string
  cwd?: string | null
}) {
  if (!input.cwd?.trim()) {
    return input.workspaceDirectory
  }

  const normalizedRelativePath = input.cwd
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
  if (!normalizedRelativePath || normalizedRelativePath === ".") {
    return input.workspaceDirectory
  }

  return path.join(input.workspaceDirectory, normalizedRelativePath)
}

export class DockerSandboxProvider implements SandboxProvisioningPort {
  readonly provider = "docker" as const

  private readonly commandHandles = new Map<
    string,
    DockerSandboxCommandHandle
  >()
  private readonly repositoryRootDirectory = getRepositoryRootDirectory()

  constructor(
    private readonly rootDirectory: string,
    private readonly runCli: SbxCliRunner = runSbxCli,
    private readonly logger?: DockerSandboxLogger,
  ) {}

  private async prepareWorkspace(input: {
    providerSandboxId: string
    source: Parameters<SandboxProvisioningPort["createSandbox"]>[0]["source"]
  }) {
    const workspaceDirectory = toWorkspaceDirectory(
      this.rootDirectory,
      input.providerSandboxId,
    )
    await rm(workspaceDirectory, { recursive: true, force: true })
    await mkdir(path.dirname(workspaceDirectory), { recursive: true })

    switch (input.source.type) {
      case "empty":
        await mkdir(workspaceDirectory, { recursive: true })
        break
      case "directory": {
        const sourcePath = path.resolve(input.source.path)
        if (await isGitRepository(sourcePath)) {
          await ensureGitCheckoutFromDirectory({
            sourcePath,
            targetPath: workspaceDirectory,
          })
        } else {
          await ensureDirectorySnapshot({
            sourcePath,
            targetPath: workspaceDirectory,
          })
        }
        break
      }
      case "git":
        await ensureGitCheckoutFromRemote({
          repositoryUrl: input.source.repositoryUrl,
          ref: input.source.ref,
          targetPath: workspaceDirectory,
        })
        break
      case "tarball":
        throw new Error(
          "Docker Sandboxes provider does not support tarball sources yet.",
        )
      case "snapshot": {
        const snapshotWorkspaceDirectory = toSnapshotWorkspaceDirectory(
          this.rootDirectory,
          input.source.snapshotId,
        )
        if (!(await pathExists(snapshotWorkspaceDirectory))) {
          throw new Error(
            `Sandbox snapshot workspace was not found: ${snapshotWorkspaceDirectory}`,
          )
        }
        await ensureDirectorySnapshot({
          sourcePath: snapshotWorkspaceDirectory,
          targetPath: workspaceDirectory,
        })
        break
      }
    }

    return workspaceDirectory
  }

  async createSandbox(
    input: Parameters<SandboxProvisioningPort["createSandbox"]>[0],
  ) {
    const providerSandboxId = `harbor-${randomUUID()}`
    const workspaceDirectory = await this.prepareWorkspace({
      providerSandboxId,
      source: input.source,
    })

    const args = ["create", "--name", providerSandboxId]
    if (input.source.type === "snapshot") {
      const snapshotMetadata = await readSnapshotMetadata(
        this.rootDirectory,
        input.source.snapshotId,
      )
      args.push("-t", snapshotMetadata.templateTag)
    }

    args.push(
      DEFAULT_SBX_AGENT,
      workspaceDirectory,
      `${this.repositoryRootDirectory}:ro`,
    )

    const created = await this.runCli(args)
    if (created.exitCode !== 0) {
      throw new Error(created.stderr || "Failed to create Docker sandbox.")
    }

    this.logger?.info?.(
      `[harbor:sandbox] created ${providerSandboxId} agent=${DEFAULT_SBX_AGENT} source=${input.source.type} workspace=${workspaceDirectory}`,
    )

    return {
      providerSandboxId,
      workingDirectory: workspaceDirectory,
      previewBaseUrl: null,
    }
  }

  async destroySandbox(providerSandboxId: string) {
    const stopped = await this.runCli(["stop", providerSandboxId])
    if (stopped.exitCode !== 0) {
      this.logger?.warn?.(
        `[harbor:sandbox] stop before destroy failed sandbox=${providerSandboxId} ${summarizeCliResult(stopped)}`,
      )
    }

    const removed = await this.runCli(["rm", providerSandboxId])
    if (removed.exitCode !== 0) {
      throw new Error(removed.stderr || "Failed to remove Docker sandbox.")
    }

    await rm(toSandboxDirectory(this.rootDirectory, providerSandboxId), {
      recursive: true,
      force: true,
    })
    this.logger?.info?.(`[harbor:sandbox] destroyed ${providerSandboxId}`)
  }

  async createSnapshot(providerSandboxId: string) {
    const workspaceDirectory = toWorkspaceDirectory(
      this.rootDirectory,
      providerSandboxId,
    )
    if (!(await pathExists(workspaceDirectory))) {
      throw new Error(`Docker sandbox "${providerSandboxId}" was not found.`)
    }

    const providerSnapshotId = `snapshot_${randomUUID()}`
    const templateTag = buildTemplateTag(providerSnapshotId)
    const snapshotWorkspaceDirectory = toSnapshotWorkspaceDirectory(
      this.rootDirectory,
      providerSnapshotId,
    )
    const snapshotMetadataPath = toSnapshotMetadataPath(
      this.rootDirectory,
      providerSnapshotId,
    )

    await mkdir(path.dirname(snapshotMetadataPath), { recursive: true })
    await ensureDirectorySnapshot({
      sourcePath: workspaceDirectory,
      targetPath: snapshotWorkspaceDirectory,
    })

    const saved = await this.runCli(["save", providerSandboxId, templateTag])
    if (saved.exitCode !== 0) {
      await rm(toSnapshotDirectory(this.rootDirectory, providerSnapshotId), {
        recursive: true,
        force: true,
      })
      throw new Error(saved.stderr || "Failed to save Docker sandbox snapshot.")
    }

    await writeFile(
      snapshotMetadataPath,
      JSON.stringify({
        templateTag,
      } satisfies SnapshotMetadata),
      "utf8",
    )

    this.logger?.info?.(
      `[harbor:sandbox] snapshot ${providerSandboxId} -> ${providerSnapshotId} template=${templateTag}`,
    )

    return {
      providerSnapshotId,
      providerSnapshotRef: templateTag,
    }
  }

  async writeFiles(providerSandboxId: string, files: SandboxFileInput[]) {
    const workspaceDirectory = toWorkspaceDirectory(
      this.rootDirectory,
      providerSandboxId,
    )
    if (!(await pathExists(workspaceDirectory))) {
      throw new Error(`Docker sandbox "${providerSandboxId}" was not found.`)
    }

    for (const file of files) {
      const targetPath = path.join(workspaceDirectory, file.path)
      await mkdir(path.dirname(targetPath), { recursive: true })
      await writeFile(targetPath, file.content)
    }
  }

  async readFile(providerSandboxId: string, filePath: string) {
    const workspaceDirectory = toWorkspaceDirectory(
      this.rootDirectory,
      providerSandboxId,
    )
    if (!(await pathExists(workspaceDirectory))) {
      throw new Error(`Docker sandbox "${providerSandboxId}" was not found.`)
    }

    return readFile(path.join(workspaceDirectory, filePath))
  }

  async runCommand(input: {
    providerSandboxId: string
    command: string
    cwd?: string | null
    env?: Record<string, string>
    detached?: boolean
  }): Promise<SandboxCommand> {
    const workspaceDirectory = toWorkspaceDirectory(
      this.rootDirectory,
      input.providerSandboxId,
    )
    if (!(await pathExists(workspaceDirectory))) {
      throw new Error(
        `Docker sandbox "${input.providerSandboxId}" was not found.`,
      )
    }

    const providerCommandId = `command_${randomUUID()}`
    const logQueue = new AsyncLineQueue()
    const commandCwd = input.cwd?.trim()
      ? path.join(workspaceDirectory, input.cwd.trim())
      : workspaceDirectory
    const sandboxWorkdir = resolveContainerWorkingDirectory({
      workspaceDirectory,
      cwd: input.cwd,
    })
    const sbxArgs = ["exec", "--workdir", sandboxWorkdir]
    if (input.detached) {
      sbxArgs.push("--detach")
    }
    if (input.env) {
      for (const [key, value] of Object.entries(input.env)) {
        sbxArgs.push("--env", `${key}=${value}`)
      }
    }
    sbxArgs.push(input.providerSandboxId, "sh", "-lc", input.command)

    const childProcess = spawn(SBX_CLI_NAME, sbxArgs, {
      cwd: workspaceDirectory,
      stdio: ["ignore", "pipe", "pipe"],
      env: buildChildProcessEnv(),
      windowsHide: true,
      detached: input.detached ?? false,
    })
    this.logger?.info?.(
      `[harbor:sandbox] exec ${input.providerSandboxId} cwd=${commandCwd} command=${input.command}`,
    )

    let stdoutBuffer = ""
    let stderrBuffer = ""

    childProcess.stdout?.on("data", (chunk) => {
      stdoutBuffer += chunk.toString()
      const drained = drainCompletedLines(stdoutBuffer)
      stdoutBuffer = drained.trailing
      for (const line of drained.lines) {
        logQueue.push(line)
      }
    })

    childProcess.stderr?.on("data", (chunk) => {
      stderrBuffer += chunk.toString()
      const drained = drainCompletedLines(stderrBuffer)
      stderrBuffer = drained.trailing
      for (const line of drained.lines) {
        logQueue.push(line)
      }
    })

    const waitResult = new Promise<{ exitCode: number | null }>((resolve) => {
      childProcess.on("close", (exitCode) => {
        const tailLines = [
          ...drainCompletedLines(stdoutBuffer).lines,
          ...drainCompletedLines(stderrBuffer).lines,
          ...[stdoutBuffer.trimEnd(), stderrBuffer.trimEnd()].filter(Boolean),
        ]
        stdoutBuffer = ""
        stderrBuffer = ""
        for (const line of tailLines) {
          logQueue.push(line)
        }
        logQueue.close()
        resolve({ exitCode })
      })

      childProcess.on("error", (error) => {
        logQueue.push(readCommandError(error))
        logQueue.close()
        resolve({ exitCode: null })
      })
    })

    const handle = new DockerSandboxCommandHandle(
      providerCommandId,
      childProcess,
      logQueue,
      waitResult,
    )
    this.commandHandles.set(providerCommandId, handle)
    void waitResult.then((result) => {
      this.logger?.info?.(
        `[harbor:sandbox] exec completed ${input.providerSandboxId} command=${providerCommandId} exit=${result.exitCode ?? "unknown"}`,
      )
    })

    return {
      providerCommandId,
      command: input.command,
      cwd: commandCwd,
      detached: input.detached ?? false,
      startedAt: new Date(),
    }
  }

  async getCommand(input: {
    providerSandboxId: string
    providerCommandId: string
  }) {
    if (
      !(await pathExists(
        toWorkspaceDirectory(this.rootDirectory, input.providerSandboxId),
      ))
    ) {
      return null
    }

    return this.commandHandles.get(input.providerCommandId) ?? null
  }

  async resolvePreviewUrl(input: { providerSandboxId: string; port: number }) {
    let publishedPorts = await listPublishedPorts(
      this.runCli,
      input.providerSandboxId,
    )
    let binding = publishedPorts.find(
      (record) => record.sandboxPort === input.port,
    )

    if (!binding) {
      const published = await this.runCli([
        "ports",
        input.providerSandboxId,
        "--publish",
        `${input.port}`,
      ])
      if (published.exitCode !== 0) {
        throw new Error(published.stderr || "Failed to publish sandbox port.")
      }

      publishedPorts = await listPublishedPorts(
        this.runCli,
        input.providerSandboxId,
      )
      binding = publishedPorts.find(
        (record) => record.sandboxPort === input.port,
      )
    }

    if (binding?.hostPort) {
      const resolvedHost =
        binding.hostIp &&
        binding.hostIp !== "0.0.0.0" &&
        binding.hostIp !== "::"
          ? binding.hostIp
          : "127.0.0.1"
      const resolvedUrl = `http://${resolvedHost}:${binding.hostPort}`
      this.logger?.info?.(
        `[harbor:sandbox] preview ${input.providerSandboxId} port=${input.port} url=${resolvedUrl}`,
      )
      return resolvedUrl
    }

    const fallbackUrl = `http://127.0.0.1:${input.port}`
    this.logger?.info?.(
      `[harbor:sandbox] preview ${input.providerSandboxId} port=${input.port} url=${fallbackUrl} (fallback)`,
    )
    return fallbackUrl
  }
}
