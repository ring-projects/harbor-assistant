import { spawn } from "node:child_process"
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  createTestDatabase,
  type TestDatabase,
} from "../../../../test/helpers/test-database"
import type {
  AgentInput,
  AgentRuntimeOptions,
  AgentType,
  IAgentRuntime,
} from "../../../lib/agents"
import { PrismaAgentTokenStore } from "../../auth"
import {
  createSandboxEnvironment,
  createSandboxSnapshotRecord,
  InMemorySandboxRegistry,
  type SandboxProvisioningPort,
} from "../../sandbox"
import { createInMemoryTaskNotificationBus } from "../infrastructure/notification/in-memory-task-notification-bus"
import { PrismaTaskRepository } from "../infrastructure/persistence/prisma-task-repository"
import { createCurrentTaskRuntimePort } from "./current-task-runtime-port"

async function runProcess(args: string[], cwd: string) {
  return new Promise<{
    exitCode: number | null
    stdout: string
    stderr: string
  }>((resolve, reject) => {
    const childProcess = spawn(args[0] ?? "", args.slice(1), {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    })

    let stdout = ""
    let stderr = ""

    childProcess.stdout?.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    childProcess.stderr?.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    childProcess.on("error", reject)
    childProcess.on("close", (exitCode) => {
      resolve({
        exitCode,
        stdout,
        stderr,
      })
    })
  })
}

function createSandboxProviderStub(
  rootDirectory: string,
): SandboxProvisioningPort {
  let sandboxCounter = 0

  return {
    provider: "docker",
    async createSandbox(input) {
      sandboxCounter += 1
      const providerSandboxId = `provider-sandbox-${sandboxCounter}`
      const sandboxDirectory = path.join(rootDirectory, providerSandboxId)
      const workingDirectory = path.join(sandboxDirectory, "workspace")

      await mkdir(sandboxDirectory, { recursive: true })

      if (input.source.type === "directory") {
        const cloned = await runProcess(
          ["git", "clone", "--quiet", input.source.path, workingDirectory],
          rootDirectory,
        )
        if (cloned.exitCode !== 0) {
          throw new Error(
            cloned.stderr || "Failed to create sandbox test clone.",
          )
        }
      } else {
        throw new Error(
          "Sandbox test provider only supports directory sources.",
        )
      }

      return {
        providerSandboxId,
        workingDirectory,
        previewBaseUrl: null,
      }
    },
    async destroySandbox() {},
    async createSnapshot() {
      return {
        providerSnapshotId: "snapshot-test",
      }
    },
    async writeFiles() {},
    async readFile() {
      return new Uint8Array()
    },
    async runCommand() {
      return {
        providerCommandId: "command-test",
        command: "true",
        cwd: null,
        detached: false,
        startedAt: new Date(),
      }
    },
    async getCommand() {
      return null
    },
    async resolvePreviewUrl(input) {
      return `http://127.0.0.1:${input.port}`
    },
  }
}

function createSnapshotPreferringSandboxProviderStub(rootDirectory: string) {
  let sandboxCounter = 0
  let lastSourceType: string | null = null

  const provider: SandboxProvisioningPort = {
    provider: "docker",
    async createSandbox(input) {
      sandboxCounter += 1
      lastSourceType = input.source.type
      const providerSandboxId = `provider-sandbox-${sandboxCounter}`
      const sandboxDirectory = path.join(rootDirectory, providerSandboxId)
      const workingDirectory = path.join(sandboxDirectory, "workspace")
      await mkdir(workingDirectory, { recursive: true })
      await writeFile(
        path.join(workingDirectory, "BOOTSTRAPPED.txt"),
        input.source.type,
        "utf8",
      )

      return {
        providerSandboxId,
        workingDirectory,
        previewBaseUrl: null,
      }
    },
    async destroySandbox() {},
    async createSnapshot() {
      return {
        providerSnapshotId: "snapshot-test",
      }
    },
    async writeFiles() {},
    async readFile() {
      return new Uint8Array()
    },
    async runCommand() {
      return {
        providerCommandId: "command-test",
        command: "true",
        cwd: null,
        detached: false,
        startedAt: new Date(),
      }
    },
    async getCommand() {
      return null
    },
    async resolvePreviewUrl(input) {
      return `http://127.0.0.1:${input.port}`
    },
  }

  return {
    provider,
    readLastSourceType() {
      return lastSourceType
    },
  }
}

describe("Current task runtime port", () => {
  let database: TestDatabase | null = null
  const tempRoots = new Set<string>()

  afterEach(async () => {
    await database?.cleanup()
    database = null
    for (const rootPath of tempRoots) {
      await rm(rootPath, { recursive: true, force: true })
      tempRoots.delete(rootPath)
    }
  })

  it("fails both task and execution when startTaskExecution cannot resolve a runtime", async () => {
    database = await createTestDatabase()
    const { prisma } = database

    await prisma.project.create({
      data: {
        id: "project-1",
        name: "Project 1",
        rootPath: "/tmp/project-1",
        normalizedPath: "/tmp/project-1",
      },
    })
    await prisma.orchestration.create({
      data: {
        id: "orchestration-1",
        projectId: "project-1",
        title: "Project 1",
      },
    })

    await prisma.task.create({
      data: {
        id: "task-1",
        projectId: "project-1",
        orchestrationId: "orchestration-1",
        prompt: "Investigate runtime failure",
        title: "Investigate runtime failure",
        status: "queued",
      },
    })

    await prisma.execution.create({
      data: {
        ownerType: "task",
        ownerId: "task-1",
        executorType: "codex",
        executorModel: null,
        executionMode: "safe",
        executorEffort: "medium",
        workingDirectory: "/tmp/project-1",
        status: "queued",
      },
    })

    const bus = createInMemoryTaskNotificationBus()
    const runtimePort = createCurrentTaskRuntimePort({
      prisma,
      taskRepository: new PrismaTaskRepository(prisma),
      notificationPublisher: bus.publisher,
      resolveAgentRuntime: (_type: AgentType): IAgentRuntime => {
        throw new Error("runtime unavailable")
      },
    })

    await expect(
      runtimePort.startTaskExecution({
        taskId: "task-1",
        projectId: "project-1",
        projectPath: "/tmp/project-1",
        input: "Investigate runtime failure",
        runtimeConfig: {
          executor: "codex",
          model: null,
          executionMode: "safe",
          effort: "medium",
        },
      }),
    ).rejects.toThrow("runtime unavailable")

    const [task, execution, events] = await Promise.all([
      prisma.task.findUniqueOrThrow({
        where: { id: "task-1" },
      }),
      prisma.execution.findUniqueOrThrow({
        where: { ownerId: "task-1" },
      }),
      prisma.executionEvent.findMany({
        where: {
          execution: {
            ownerId: "task-1",
          },
        },
        orderBy: {
          sequence: "asc",
        },
      }),
    ])

    expect(task.status).toBe("failed")
    expect(execution.status).toBe("failed")
    expect(execution.errorMessage).toBe("runtime unavailable")
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      rawEventType: "message",
      source: "harbor",
      rawPayload: {
        role: "user",
        input: "Investigate runtime failure",
        summary: "Investigate runtime failure",
        source: "user_input",
      },
    })
    expect(events[1]?.rawEventType).toBe("error")
    expect(events[1]?.source).toBe("harbor")
  })

  it("uses the supplied runtime snapshot when resuming an execution", async () => {
    database = await createTestDatabase()
    const { prisma } = database

    await prisma.project.create({
      data: {
        id: "project-1",
        name: "Project 1",
        rootPath: "/tmp/project-1",
        normalizedPath: "/tmp/project-1",
      },
    })
    await prisma.orchestration.create({
      data: {
        id: "orchestration-1",
        projectId: "project-1",
        title: "Project 1",
      },
    })

    await prisma.task.create({
      data: {
        id: "task-1",
        projectId: "project-1",
        orchestrationId: "orchestration-1",
        prompt: "Investigate runtime failure",
        title: "Investigate runtime failure",
        status: "completed",
      },
    })

    await prisma.execution.create({
      data: {
        ownerType: "task",
        ownerId: "task-1",
        executorType: "codex",
        executorModel: "gpt-5.3-codex",
        executionMode: "safe",
        executorEffort: "high",
        workingDirectory: "/tmp/project-1",
        sessionId: "session-1",
        status: "completed",
      },
    })

    let resolveResumeCall:
      | ((value: {
          sessionId: string
          options: AgentRuntimeOptions
          input: AgentInput
        }) => void)
      | null = null
    const resumeCall = new Promise<{
      sessionId: string
      options: AgentRuntimeOptions
      input: AgentInput
    }>((resolve) => {
      resolveResumeCall = resolve
    })

    const runtime: IAgentRuntime = {
      type: "codex",
      async *startSessionAndRun() {},
      resumeSessionAndRun(sessionId, options, input) {
        resolveResumeCall?.({
          sessionId,
          options,
          input,
        })
        return (async function* () {})()
      },
    }

    const bus = createInMemoryTaskNotificationBus()
    const runtimePort = createCurrentTaskRuntimePort({
      prisma,
      taskRepository: new PrismaTaskRepository(prisma),
      notificationPublisher: bus.publisher,
      resolveAgentRuntime: (_type: AgentType) => runtime,
    })

    await runtimePort.resumeTaskExecution({
      taskId: "task-1",
      projectId: "project-1",
      projectPath: "/tmp/project-1",
      input: "Continue from the saved execution state.",
      runtimeConfig: {
        executor: "codex",
        model: null,
        executionMode: "safe",
        effort: null,
      },
    })

    await expect(resumeCall).resolves.toMatchObject({
      sessionId: "session-1",
      input: expect.stringContaining(
        "Continue from the saved execution state.",
      ),
      options: expect.objectContaining({
        modelId: undefined,
        effort: undefined,
      }),
    })

    await expect
      .poll(async () => {
        const execution = await prisma.execution.findUnique({
          where: {
            ownerId: "task-1",
          },
          select: {
            executorModel: true,
            executorEffort: true,
          },
        })

        return execution
      })
      .toEqual({
        executorModel: null,
        executorEffort: null,
      })

    await expect
      .poll(async () => {
        const execution = await prisma.execution.findUnique({
          where: {
            ownerId: "task-1",
          },
          select: {
            status: true,
          },
        })

        return execution?.status ?? null
      })
      .toBe("completed")
  })

  it("cancels an in-flight execution through the runtime abort signal", async () => {
    database = await createTestDatabase()
    const { prisma } = database

    await prisma.project.create({
      data: {
        id: "project-1",
        name: "Project 1",
        rootPath: "/tmp/project-1",
        normalizedPath: "/tmp/project-1",
      },
    })
    await prisma.orchestration.create({
      data: {
        id: "orchestration-1",
        projectId: "project-1",
        title: "Project 1",
      },
    })

    await prisma.task.create({
      data: {
        id: "task-1",
        projectId: "project-1",
        orchestrationId: "orchestration-1",
        prompt: "Investigate runtime failure",
        title: "Investigate runtime failure",
        status: "queued",
      },
    })

    await prisma.execution.create({
      data: {
        ownerType: "task",
        ownerId: "task-1",
        executorType: "codex",
        executorModel: null,
        executionMode: "safe",
        executorEffort: "medium",
        workingDirectory: "/tmp/project-1",
        status: "queued",
      },
    })

    let observedAbort = false
    let resolveStarted: (() => void) | null = null
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve
    })

    const runtime: IAgentRuntime = {
      type: "codex",
      async *startSessionAndRun(_options, _input, signal) {
        resolveStarted?.()

        yield {
          agentType: "codex",
          createdAt: new Date("2026-03-29T00:00:00.000Z"),
          event: {
            type: "thread.started",
            thread_id: "session-cancel",
          },
        }

        await new Promise<never>((_resolve, reject) => {
          if (!signal) {
            reject(new Error("missing abort signal"))
            return
          }

          if (signal.aborted) {
            observedAbort = true
            reject(new Error(String(signal.reason ?? "aborted")))
            return
          }

          signal.addEventListener(
            "abort",
            () => {
              observedAbort = true
              reject(new Error(String(signal.reason ?? "aborted")))
            },
            { once: true },
          )
        })
      },
      async *resumeSessionAndRun() {},
    }

    const bus = createInMemoryTaskNotificationBus()
    const runtimePort = createCurrentTaskRuntimePort({
      prisma,
      taskRepository: new PrismaTaskRepository(prisma),
      notificationPublisher: bus.publisher,
      resolveAgentRuntime: (_type: AgentType) => runtime,
    })

    await runtimePort.startTaskExecution({
      taskId: "task-1",
      projectId: "project-1",
      projectPath: "/tmp/project-1",
      input: "Investigate runtime failure",
      runtimeConfig: {
        executor: "codex",
        model: null,
        executionMode: "safe",
        effort: "medium",
      },
    })

    await started
    expect(observedAbort).toBe(false)

    await runtimePort.cancelTaskExecution({
      taskId: "task-1",
      reason: "User requested stop",
    })

    const [task, execution, events] = await Promise.all([
      prisma.task.findUniqueOrThrow({
        where: { id: "task-1" },
      }),
      prisma.execution.findUniqueOrThrow({
        where: { ownerId: "task-1" },
      }),
      prisma.executionEvent.findMany({
        where: {
          execution: {
            ownerId: "task-1",
          },
        },
        orderBy: {
          sequence: "asc",
        },
      }),
    ])

    expect(observedAbort).toBe(true)
    expect(task.status).toBe("cancelled")
    expect(execution.status).toBe("cancelled")
    expect(execution.sessionId).toBe("session-cancel")
    expect(events.map((event) => event.rawEventType)).toEqual(
      expect.arrayContaining([
        "message",
        "session.started",
        "harbor.cancel_requested",
        "harbor.cancelled",
      ]),
    )
  })

  it("mounts Harbor CLI bridge env, wrapper, and skills for runtime sessions", async () => {
    database = await createTestDatabase()
    const { prisma } = database
    const projectRoot = await mkdtemp(
      path.join(os.tmpdir(), "harbor-runtime-project-"),
    )
    const skillsRootParent = await mkdtemp(
      path.join(os.tmpdir(), "harbor-runtime-skills-"),
    )
    tempRoots.add(projectRoot)
    tempRoots.add(skillsRootParent)

    const publicSkillsRootDirectory = path.join(skillsRootParent, "default")
    await mkdir(path.join(publicSkillsRootDirectory, "harbor-cli"), {
      recursive: true,
    })
    await writeFile(
      path.join(publicSkillsRootDirectory, "harbor-cli", "SKILL.md"),
      "# Harbor CLI\n",
      "utf8",
    )

    await prisma.project.create({
      data: {
        id: "project-1",
        name: "Project 1",
        rootPath: projectRoot,
        normalizedPath: projectRoot,
      },
    })
    await prisma.orchestration.create({
      data: {
        id: "orchestration-1",
        projectId: "project-1",
        title: "Project 1",
      },
    })
    await prisma.task.create({
      data: {
        id: "task-1",
        projectId: "project-1",
        orchestrationId: "orchestration-1",
        prompt: "Inspect Harbor bridge setup",
        title: "Inspect Harbor bridge setup",
        status: "queued",
      },
    })
    await prisma.execution.create({
      data: {
        ownerType: "task",
        ownerId: "task-1",
        executorType: "codex",
        executorModel: "gpt-5.4",
        executionMode: "connected",
        executorEffort: "medium",
        workingDirectory: projectRoot,
        status: "queued",
      },
    })

    let resolveCall:
      | ((value: { options: AgentRuntimeOptions; input: AgentInput }) => void)
      | null = null
    const call = new Promise<{
      options: AgentRuntimeOptions
      input: AgentInput
    }>((resolve) => {
      resolveCall = resolve
    })

    const runtime: IAgentRuntime = {
      type: "codex",
      async *startSessionAndRun(options, input) {
        resolveCall?.({ options, input })
      },
      async *resumeSessionAndRun() {},
    }

    const bus = createInMemoryTaskNotificationBus()
    const runtimePort = createCurrentTaskRuntimePort({
      prisma,
      taskRepository: new PrismaTaskRepository(prisma),
      notificationPublisher: bus.publisher,
      harborApiBaseUrl: "http://127.0.0.1:3400/v1",
      publicSkillsRootDirectory,
      agentTokenStore: new PrismaAgentTokenStore(prisma),
      resolveAgentRuntime: (_type: AgentType) => runtime,
    })

    await runtimePort.startTaskExecution({
      taskId: "task-1",
      projectId: "project-1",
      projectPath: projectRoot,
      input: "Inspect Harbor bridge setup",
      runtimeConfig: {
        executor: "codex",
        model: "gpt-5.4",
        executionMode: "connected",
        effort: "medium",
      },
    })

    await expect(call).resolves.toMatchObject({
      options: expect.objectContaining({
        env: expect.objectContaining({
          HARBOR_SERVICE_BASE_URL: "http://127.0.0.1:3400/v1",
          HARBOR_PROJECT_ID: "project-1",
          HARBOR_TASK_ID: "task-1",
          HARBOR_ORCHESTRATION_ID: "orchestration-1",
          HARBOR_CLI: "harbor",
          HARBOR_CLI_PATH: path.join(projectRoot, ".harbor", "bin", "harbor"),
          HARBOR_TOKEN: expect.any(String),
          PATH: expect.stringContaining(
            path.join(projectRoot, ".harbor", "bin"),
          ),
        }),
      }),
      input: expect.stringContaining("Harbor runtime context:"),
    })

    const runtimeCall = await call
    expect(typeof runtimeCall.input).toBe("string")
    expect(String(runtimeCall.input)).toContain("Inspect Harbor bridge setup")
    expect(String(runtimeCall.input)).toContain("harbor task events")

    await expect(
      access(path.join(projectRoot, ".harbor", "bin", "harbor")),
    ).resolves.toBeUndefined()
    await expect(
      access(
        path.join(projectRoot, ".codex", "skills", "harbor-cli", "SKILL.md"),
      ),
    ).resolves.toBeUndefined()

    await expect
      .poll(async () => {
        const execution = await prisma.execution.findUnique({
          where: {
            ownerId: "task-1",
          },
          select: {
            status: true,
          },
        })

        return execution?.status ?? null
      })
      .toBe("completed")
  })

  it("injects workspace-level codex BYOK env into runtime executions", async () => {
    database = await createTestDatabase()
    const { prisma } = database
    const projectRoot = await mkdtemp(
      path.join(os.tmpdir(), "harbor-runtime-project-"),
    )
    tempRoots.add(projectRoot)

    await prisma.project.create({
      data: {
        id: "project-1",
        name: "Project 1",
        rootPath: projectRoot,
        normalizedPath: projectRoot,
      },
    })
    await prisma.orchestration.create({
      data: {
        id: "orchestration-1",
        projectId: "project-1",
        title: "Project 1",
      },
    })
    await prisma.task.create({
      data: {
        id: "task-1",
        projectId: "project-1",
        orchestrationId: "orchestration-1",
        prompt: "Use BYOK runtime",
        title: "Use BYOK runtime",
        status: "queued",
      },
    })
    await prisma.execution.create({
      data: {
        ownerType: "task",
        ownerId: "task-1",
        executorType: "codex",
        executorModel: "gpt-5.4",
        executionMode: "connected",
        executorEffort: "medium",
        workingDirectory: projectRoot,
        status: "queued",
      },
    })

    let resolveCall:
      | ((value: { options: AgentRuntimeOptions; input: AgentInput }) => void)
      | null = null
    const call = new Promise<{
      options: AgentRuntimeOptions
      input: AgentInput
    }>((resolve) => {
      resolveCall = resolve
    })

    const runtime: IAgentRuntime = {
      type: "codex",
      async *startSessionAndRun(options, input) {
        resolveCall?.({ options, input })
      },
      async *resumeSessionAndRun() {},
    }

    const bus = createInMemoryTaskNotificationBus()
    const runtimePort = createCurrentTaskRuntimePort({
      prisma,
      taskRepository: new PrismaTaskRepository(prisma),
      notificationPublisher: bus.publisher,
      resolveAgentRuntime: (_type: AgentType) => runtime,
    })

    await runtimePort.startTaskExecution({
      taskId: "task-1",
      projectId: "project-1",
      projectPath: projectRoot,
      projectCodex: {
        baseUrl: "https://gateway.example.com/v1",
        apiKey: "gateway-token",
      },
      input: "Use the configured gateway",
      runtimeConfig: {
        executor: "codex",
        model: "gpt-5.4",
        executionMode: "connected",
        effort: "medium",
      },
    })

    await expect(call).resolves.toMatchObject({
      options: expect.objectContaining({
        env: expect.objectContaining({
          OPENAI_BASE_URL: "https://gateway.example.com/v1",
          CODEX_API_KEY: "gateway-token",
        }),
      }),
    })
  })

  it("runs git-backed task sessions inside an isolated sandbox clone", async () => {
    database = await createTestDatabase()
    const { prisma } = database
    const projectRoot = await mkdtemp(
      path.join(os.tmpdir(), "harbor-runtime-project-"),
    )
    const sandboxRoot = await mkdtemp(
      path.join(os.tmpdir(), "harbor-runtime-sandboxes-"),
    )
    tempRoots.add(projectRoot)
    tempRoots.add(sandboxRoot)

    await runProcess(["git", "init", "--quiet"], projectRoot)
    await runProcess(
      ["git", "config", "user.email", "sandbox@example.com"],
      projectRoot,
    )
    await runProcess(
      ["git", "config", "user.name", "Sandbox Test"],
      projectRoot,
    )
    await writeFile(path.join(projectRoot, "README.md"), "origin\n", "utf8")
    await runProcess(["git", "add", "README.md"], projectRoot)
    await runProcess(["git", "commit", "--quiet", "-m", "init"], projectRoot)

    await prisma.project.create({
      data: {
        id: "project-1",
        name: "Project 1",
        rootPath: projectRoot,
        normalizedPath: projectRoot,
      },
    })
    await prisma.orchestration.create({
      data: {
        id: "orchestration-1",
        projectId: "project-1",
        title: "Project 1",
      },
    })
    await prisma.task.create({
      data: {
        id: "task-1",
        projectId: "project-1",
        orchestrationId: "orchestration-1",
        prompt: "Inspect sandbox working directory",
        title: "Inspect sandbox working directory",
        status: "queued",
      },
    })
    await prisma.execution.create({
      data: {
        ownerType: "task",
        ownerId: "task-1",
        executorType: "claude-code",
        executorModel: "gpt-5.4",
        executionMode: "safe",
        executorEffort: "medium",
        workingDirectory: projectRoot,
        status: "queued",
      },
    })

    let resolveCall:
      | ((value: { options: AgentRuntimeOptions; input: AgentInput }) => void)
      | null = null
    const call = new Promise<{
      options: AgentRuntimeOptions
      input: AgentInput
    }>((resolve) => {
      resolveCall = resolve
    })

    const runtime: IAgentRuntime = {
      type: "claude-code",
      async *startSessionAndRun(options, input) {
        await writeFile(
          path.join(options.workingDirectory, "SANDBOX_ONLY.txt"),
          "sandbox-only\n",
          "utf8",
        )
        resolveCall?.({ options, input })
      },
      async *resumeSessionAndRun() {},
    }

    const bus = createInMemoryTaskNotificationBus()
    const sandboxProvider = createSandboxProviderStub(sandboxRoot)
    const runtimePort = createCurrentTaskRuntimePort({
      prisma,
      taskRepository: new PrismaTaskRepository(prisma),
      notificationPublisher: bus.publisher,
      sandbox: {
        provider: sandboxProvider,
        registry: new InMemorySandboxRegistry(),
      },
      resolveAgentRuntime: (_type: AgentType) => runtime,
    })

    await runtimePort.startTaskExecution({
      taskId: "task-1",
      projectId: "project-1",
      projectPath: projectRoot,
      input: "Inspect sandbox working directory",
      runtimeConfig: {
        executor: "claude-code",
        model: "gpt-5.4",
        executionMode: "safe",
        effort: "medium",
      },
    })

    const runtimeCall = await call
    expect(runtimeCall.options.workingDirectory).not.toBe(projectRoot)
    expect(runtimeCall.options.workingDirectory).toContain(sandboxRoot)

    await expect(
      access(path.join(runtimeCall.options.workingDirectory, "README.md")),
    ).resolves.toBeUndefined()
    await expect(
      access(
        path.join(runtimeCall.options.workingDirectory, "SANDBOX_ONLY.txt"),
      ),
    ).resolves.toBeUndefined()
    await expect(
      access(path.join(projectRoot, "SANDBOX_ONLY.txt")),
    ).rejects.toThrow()

    await expect
      .poll(async () => {
        const execution = await prisma.execution.findUnique({
          where: {
            ownerId: "task-1",
          },
          select: {
            workingDirectory: true,
            status: true,
          },
        })

        return execution
      })
      .toMatchObject({
        workingDirectory: runtimeCall.options.workingDirectory,
        status: "completed",
      })
  })

  it("prefers a project bootstrap snapshot when starting sandboxed task sessions", async () => {
    database = await createTestDatabase()
    const { prisma } = database
    const projectRoot = await mkdtemp(
      path.join(os.tmpdir(), "harbor-runtime-project-"),
    )
    const sandboxRoot = await mkdtemp(
      path.join(os.tmpdir(), "harbor-runtime-sandboxes-"),
    )
    tempRoots.add(projectRoot)
    tempRoots.add(sandboxRoot)

    await prisma.project.create({
      data: {
        id: "project-1",
        name: "Project 1",
        rootPath: projectRoot,
        normalizedPath: projectRoot,
      },
    })
    await prisma.orchestration.create({
      data: {
        id: "orchestration-1",
        projectId: "project-1",
        title: "Project 1",
      },
    })
    await prisma.task.create({
      data: {
        id: "task-1",
        projectId: "project-1",
        orchestrationId: "orchestration-1",
        prompt: "Use the template snapshot",
        title: "Use the template snapshot",
        status: "queued",
      },
    })
    await prisma.execution.create({
      data: {
        ownerType: "task",
        ownerId: "task-1",
        executorType: "claude-code",
        executorModel: "sonnet",
        executionMode: "safe",
        executorEffort: "medium",
        workingDirectory: projectRoot,
        status: "queued",
      },
    })

    const sandboxRegistry = new InMemorySandboxRegistry()
    await sandboxRegistry.saveSandbox(
      createSandboxEnvironment({
        id: "bootstrap-sandbox-1",
        provider: "docker",
        providerSandboxId: "bootstrap-provider-1",
        mode: "safe",
        source: {
          type: "git",
          repositoryUrl: "https://github.com/acme/project-1.git",
          ref: "main",
        },
        workingDirectory: "/sandboxes/bootstrap-provider-1/workspace",
        profile: {
          vcpuCount: 2,
          memoryMb: 4096,
          idleTimeoutSeconds: 300,
          maxDurationSeconds: 1800,
        },
        networkPolicy: {
          outboundMode: "deny-all",
          allowedHosts: [],
        },
        metadata: {
          projectId: "project-1",
          taskId: null,
          purpose: "task-prepare",
          labels: {
            template: "project-bootstrap",
          },
        },
      }),
    )
    await sandboxRegistry.saveSnapshot(
      createSandboxSnapshotRecord({
        id: "bootstrap-snapshot-1",
        sandboxId: "bootstrap-sandbox-1",
        providerSnapshotId: "provider-snapshot-1",
        providerSnapshotRef: "/sandboxes/.snapshots/provider-snapshot-1.tar",
      }),
    )

    let resolveCall:
      | ((value: { options: AgentRuntimeOptions; input: AgentInput }) => void)
      | null = null
    const call = new Promise<{
      options: AgentRuntimeOptions
      input: AgentInput
    }>((resolve) => {
      resolveCall = resolve
    })

    const runtime: IAgentRuntime = {
      type: "claude-code",
      async *startSessionAndRun(options, input) {
        resolveCall?.({ options, input })
      },
      async *resumeSessionAndRun() {},
    }

    const bus = createInMemoryTaskNotificationBus()
    const sandboxProvider =
      createSnapshotPreferringSandboxProviderStub(sandboxRoot)
    const runtimePort = createCurrentTaskRuntimePort({
      prisma,
      projectRepository: {
        findById: async (id: string) =>
          id === "project-1"
            ? {
                id: "project-1",
                ownerUserId: null,
                workspaceId: null,
                slug: "project-1",
                name: "Project 1",
                description: null,
                source: {
                  type: "git",
                  repositoryUrl: "https://github.com/acme/project-1.git",
                  branch: "main",
                },
                rootPath: null,
                normalizedPath: null,
                status: "active",
                createdAt: new Date(),
                updatedAt: new Date(),
                archivedAt: null,
                lastOpenedAt: null,
                settings: {
                  retention: {
                    logRetentionDays: 30,
                    eventRetentionDays: 7,
                  },
                  codex: {
                    baseUrl: null,
                    apiKey: null,
                  },
                },
              }
            : null,
      },
      taskRepository: new PrismaTaskRepository(prisma),
      notificationPublisher: bus.publisher,
      sandbox: {
        provider: sandboxProvider.provider,
        registry: sandboxRegistry,
      },
      resolveAgentRuntime: (_type: AgentType) => runtime,
    })

    await runtimePort.startTaskExecution({
      taskId: "task-1",
      projectId: "project-1",
      projectPath: projectRoot,
      input: "Use the template snapshot",
      runtimeConfig: {
        executor: "claude-code",
        model: "sonnet",
        executionMode: "safe",
        effort: "medium",
      },
    })

    const runtimeCall = await call
    expect(sandboxProvider.readLastSourceType()).toBe("snapshot")
    expect(runtimeCall.options.workingDirectory).toContain(sandboxRoot)
    await expect(
      access(
        path.join(runtimeCall.options.workingDirectory, "BOOTSTRAPPED.txt"),
      ),
    ).resolves.toBeUndefined()
    await expect
      .poll(async () => {
        const execution = await prisma.execution.findUnique({
          where: {
            ownerId: "task-1",
          },
          select: {
            status: true,
          },
        })

        return execution?.status ?? null
      })
      .toBe("completed")
  })
})
