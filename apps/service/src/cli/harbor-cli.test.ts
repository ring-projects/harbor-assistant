import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  resolveHarborApiBaseUrl,
  resolveHarborAuthHeaders,
  runHarborCli,
} from "./harbor-cli"

const tempRoots = new Set<string>()

function createJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

describe("harbor cli", () => {
  afterEach(async () => {
    for (const rootPath of tempRoots) {
      await rm(rootPath, { recursive: true, force: true })
      tempRoots.delete(rootPath)
    }
  })

  it("resolves bearer and session-token authentication headers", () => {
    expect(
      resolveHarborAuthHeaders({
        HARBOR_TOKEN: "agent-token",
      }),
    ).toEqual({
      authorization: "Bearer agent-token",
    })

    expect(
      resolveHarborAuthHeaders({
        HARBOR_SESSION_TOKEN: "session-token",
      }),
    ).toEqual({
      cookie: "harbor_session=session-token",
    })
  })

  it("normalizes the api base url and falls back to service config", async () => {
    await expect(
      resolveHarborApiBaseUrl({
        env: {
          HARBOR_BASE_URL: "http://127.0.0.1:3400/",
        },
      }),
    ).resolves.toBe("http://127.0.0.1:3400/v1")

    await expect(
      resolveHarborApiBaseUrl({
        env: {},
        loadConfig: vi.fn(async () => ({
          appBaseUrl: "https://service.example.com/",
        })),
      }),
    ).resolves.toBe("https://service.example.com/v1")
  })

  it("calls auth/session for whoami and prints the json response", async () => {
    const stdout: string[] = []
    const stderr: string[] = []
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe("http://harbor.local/v1/auth/session")
        expect(init?.method).toBe("GET")
        expect(init?.headers).toMatchObject({
          accept: "application/json",
          authorization: "Bearer delegated-token",
        })

        return createJsonResponse({
          ok: true,
          authenticated: true,
          user: null,
          actor: {
            kind: "agent",
            tokenId: "token-1",
          },
        })
      },
    )

    const exitCode = await runHarborCli(["auth", "whoami"], {
      env: {
        HARBOR_TOKEN: "delegated-token",
        HARBOR_SERVICE_BASE_URL: "http://harbor.local",
      },
      stdout: (line) => {
        stdout.push(line)
      },
      stderr: (line) => {
        stderr.push(line)
      },
      fetchImpl: fetchImpl as typeof fetch,
    })

    expect(exitCode).toBe(0)
    expect(stderr).toEqual([])
    expect(stdout.join("\n")).toContain('"authenticated": true')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("supports --raw-field output for shell-friendly extraction", async () => {
    const stdout: string[] = []
    const stderr: string[] = []
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        ok: true,
        authenticated: true,
        user: null,
        actor: {
          kind: "agent",
          tokenId: "token-1",
        },
      }),
    )

    const exitCode = await runHarborCli(
      ["auth", "whoami", "--raw-field", "actor.tokenId"],
      {
        env: {
          HARBOR_TOKEN: "delegated-token",
          HARBOR_SERVICE_BASE_URL: "http://harbor.local",
        },
        stdout: (line) => {
          stdout.push(line)
        },
        stderr: (line) => {
          stderr.push(line)
        },
        fetchImpl: fetchImpl as typeof fetch,
      },
    )

    expect(exitCode).toBe(0)
    expect(stderr).toEqual([])
    expect(stdout).toEqual(["token-1"])
  })

  it("builds the schedule update request payload from cli flags", async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(_input)).toBe(
          "http://127.0.0.1:3400/v1/orchestrations/orch-1/schedule",
        )
        expect(init?.method).toBe("PUT")
        expect(init?.headers).toMatchObject({
          authorization: "Bearer delegated-token",
          "content-type": "application/json",
        })
        expect(JSON.parse(String(init?.body))).toEqual({
          enabled: false,
          cronExpression: "*/5 * * * *",
          timezone: "Asia/Shanghai",
          concurrencyPolicy: "skip",
          taskTemplate: {
            title: "Nightly",
            prompt: "Run the nightly maintenance flow",
            executor: "codex",
            model: "gpt-5.4",
            executionMode: "connected",
            effort: "medium",
          },
        })

        return createJsonResponse({
          ok: true,
          orchestration: {
            id: "orch-1",
          },
        })
      },
    )

    const exitCode = await runHarborCli(
      [
        "orchestration",
        "schedule",
        "set",
        "--id",
        "orch-1",
        "--cron",
        "*/5 * * * *",
        "--executor",
        "codex",
        "--model",
        "gpt-5.4",
        "--mode",
        "connected",
        "--effort",
        "medium",
        "--prompt",
        "Run the nightly maintenance flow",
        "--title",
        "Nightly",
        "--timezone",
        "Asia/Shanghai",
        "--disable",
      ],
      {
        env: {
          HARBOR_TOKEN: "delegated-token",
        },
        stdout: () => {},
        stderr: () => {},
        fetchImpl: fetchImpl as typeof fetch,
        loadConfig: vi.fn(async () => ({
          appBaseUrl: "http://127.0.0.1:3400",
        })),
      },
    )

    expect(exitCode).toBe(0)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("builds orchestration bootstrap payload with mixed agent input items", async () => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          "http://127.0.0.1:3400/v1/orchestrations/bootstrap",
        )
        expect(init?.method).toBe("POST")
        expect(JSON.parse(String(init?.body))).toEqual({
          projectId: "project-1",
          orchestration: {
            title: "Daily Triage",
            description: "Bootstrap from cli",
          },
          initialTask: {
            prompt: "Summarize repo state",
            items: [
              { type: "text", text: "Focus on open regressions" },
              { type: "local_file", path: "docs/spec.md" },
              { type: "local_image", path: "screenshots/error.png" },
            ],
            title: "Bootstrap run",
            executor: "codex",
            model: "gpt-5.4",
            executionMode: "connected",
            effort: "high",
          },
        })

        return createJsonResponse(
          {
            ok: true,
            orchestration: { id: "orch-1" },
            task: { id: "task-1" },
            bootstrap: { runtimeStarted: true, warning: null },
          },
          201,
        )
      },
    )

    const exitCode = await runHarborCli(
      [
        "orchestration",
        "bootstrap",
        "--project",
        "project-1",
        "--title",
        "Daily Triage",
        "--description",
        "Bootstrap from cli",
        "--prompt",
        "Summarize repo state",
        "--item-text",
        "Focus on open regressions",
        "--item-file",
        "docs/spec.md",
        "--item-image",
        "screenshots/error.png",
        "--task-title",
        "Bootstrap run",
        "--executor",
        "codex",
        "--model",
        "gpt-5.4",
        "--mode",
        "connected",
        "--effort",
        "high",
      ],
      {
        env: {
          HARBOR_TOKEN: "delegated-token",
        },
        stdout: () => {},
        stderr: () => {},
        fetchImpl: fetchImpl as typeof fetch,
        loadConfig: vi.fn(async () => ({
          appBaseUrl: "http://127.0.0.1:3400",
        })),
      },
    )

    expect(exitCode).toBe(0)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("builds orchestration task creation payload with item-only input", async () => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          "http://127.0.0.1:3400/v1/orchestrations/orch-1/tasks",
        )
        expect(init?.method).toBe("POST")
        expect(JSON.parse(String(init?.body))).toEqual({
          items: [
            { type: "text", text: "Check stale tasks" },
            { type: "local_file", path: "notes/todo.md" },
          ],
          title: "Follow-up run",
          executor: "codex",
          model: "gpt-5.4",
          executionMode: "safe",
          effort: "medium",
        })

        return createJsonResponse(
          {
            ok: true,
            task: { id: "task-2" },
          },
          201,
        )
      },
    )

    const exitCode = await runHarborCli(
      [
        "orchestration",
        "task",
        "create",
        "--id",
        "orch-1",
        "--item-text",
        "Check stale tasks",
        "--item-file",
        "notes/todo.md",
        "--task-title",
        "Follow-up run",
        "--executor",
        "codex",
        "--model",
        "gpt-5.4",
        "--mode",
        "safe",
        "--effort",
        "medium",
      ],
      {
        env: {
          HARBOR_TOKEN: "delegated-token",
        },
        stdout: () => {},
        stderr: () => {},
        fetchImpl: fetchImpl as typeof fetch,
        loadConfig: vi.fn(async () => ({
          appBaseUrl: "http://127.0.0.1:3400",
        })),
      },
    )

    expect(exitCode).toBe(0)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("calls task events with query params", async () => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          "http://127.0.0.1:3400/v1/tasks/task-1/events?afterSequence=10&limit=50",
        )
        expect(init?.method).toBe("GET")

        return createJsonResponse({
          ok: true,
          task: {
            id: "task-1",
          },
          events: {
            taskId: "task-1",
            items: [],
            nextSequence: 11,
          },
        })
      },
    )

    const exitCode = await runHarborCli(
      [
        "task",
        "events",
        "--id",
        "task-1",
        "--after-sequence",
        "10",
        "--limit",
        "50",
      ],
      {
        env: {
          HARBOR_TOKEN: "delegated-token",
        },
        stdout: () => {},
        stderr: () => {},
        fetchImpl: fetchImpl as typeof fetch,
        loadConfig: vi.fn(async () => ({
          appBaseUrl: "http://127.0.0.1:3400",
        })),
      },
    )

    expect(exitCode).toBe(0)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("lists orchestration tasks with includeArchived", async () => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          "http://127.0.0.1:3400/v1/orchestrations/orch-1/tasks?limit=20&includeArchived=true",
        )
        expect(init?.method).toBe("GET")

        return createJsonResponse({
          ok: true,
          tasks: [],
        })
      },
    )

    const exitCode = await runHarborCli(
      [
        "orchestration",
        "tasks",
        "list",
        "--id",
        "orch-1",
        "--limit",
        "20",
        "--include-archived",
      ],
      {
        env: {
          HARBOR_TOKEN: "delegated-token",
        },
        stdout: () => {},
        stderr: () => {},
        fetchImpl: fetchImpl as typeof fetch,
        loadConfig: vi.fn(async () => ({
          appBaseUrl: "http://127.0.0.1:3400",
        })),
      },
    )

    expect(exitCode).toBe(0)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("calls git branch creation with checkout and from-ref", async () => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          "http://127.0.0.1:3400/v1/projects/project-1/git/branches",
        )
        expect(init?.method).toBe("POST")
        expect(JSON.parse(String(init?.body))).toEqual({
          branchName: "feature/agent-cli",
          checkout: true,
          fromRef: "origin/main",
        })

        return createJsonResponse({
          ok: true,
          branches: {
            path: "/tmp/project-1",
            currentBranch: "feature/agent-cli",
            branches: [],
          },
        })
      },
    )

    const exitCode = await runHarborCli(
      [
        "git",
        "branch",
        "create",
        "--project",
        "project-1",
        "--branch",
        "feature/agent-cli",
        "--from",
        "origin/main",
        "--checkout",
      ],
      {
        env: {
          HARBOR_TOKEN: "delegated-token",
        },
        stdout: () => {},
        stderr: () => {},
        fetchImpl: fetchImpl as typeof fetch,
        loadConfig: vi.fn(async () => ({
          appBaseUrl: "http://127.0.0.1:3400",
        })),
      },
    )

    expect(exitCode).toBe(0)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("loads file content from a local path for files write", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "harbor-cli-test-"))
    tempRoots.add(tempRoot)
    const contentPath = path.join(tempRoot, "README.md")
    await writeFile(contentPath, "# Hello Harbor\n", "utf8")

    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          "http://127.0.0.1:3400/v1/projects/project-1/files/text",
        )
        expect(init?.method).toBe("POST")
        expect(JSON.parse(String(init?.body))).toEqual({
          path: "docs/README.md",
          content: "# Hello Harbor\n",
          createParents: true,
        })

        return createJsonResponse({
          ok: true,
          file: {
            path: "docs/README.md",
            content: "# Hello Harbor\n",
            size: 16,
            mtime: "2026-04-19T00:00:00.000Z",
          },
        })
      },
    )

    const exitCode = await runHarborCli(
      [
        "files",
        "write",
        "--project",
        "project-1",
        "--path",
        "docs/README.md",
        "--content-file",
        contentPath,
        "--create-parents",
      ],
      {
        env: {
          HARBOR_TOKEN: "delegated-token",
        },
        stdout: () => {},
        stderr: () => {},
        fetchImpl: fetchImpl as typeof fetch,
        loadConfig: vi.fn(async () => ({
          appBaseUrl: "http://127.0.0.1:3400",
        })),
      },
    )

    expect(exitCode).toBe(0)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("supports --raw-content for file reads", async () => {
    const stdout: string[] = []
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        ok: true,
        file: {
          path: "docs/README.md",
          content: "# Hello Harbor\n",
          size: 16,
          mtime: "2026-04-19T00:00:00.000Z",
        },
      }),
    )

    const exitCode = await runHarborCli(
      [
        "files",
        "read",
        "--project",
        "project-1",
        "--path",
        "docs/README.md",
        "--raw-content",
      ],
      {
        env: {
          HARBOR_TOKEN: "delegated-token",
        },
        stdout: (line) => {
          stdout.push(line)
        },
        stderr: () => {},
        fetchImpl: fetchImpl as typeof fetch,
        loadConfig: vi.fn(async () => ({
          appBaseUrl: "http://127.0.0.1:3400",
        })),
      },
    )

    expect(exitCode).toBe(0)
    expect(stdout).toEqual(["# Hello Harbor\n"])
  })

  it("supports --exit-on-empty when selected output is missing", async () => {
    const stdout: string[] = []
    const stderr: string[] = []
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        ok: true,
        tasks: [],
      }),
    )

    const exitCode = await runHarborCli(
      [
        "orchestration",
        "tasks",
        "list",
        "--id",
        "orch-1",
        "--raw-field",
        "tasks",
        "--exit-on-empty",
      ],
      {
        env: {
          HARBOR_TOKEN: "delegated-token",
        },
        stdout: (line) => {
          stdout.push(line)
        },
        stderr: (line) => {
          stderr.push(line)
        },
        fetchImpl: fetchImpl as typeof fetch,
        loadConfig: vi.fn(async () => ({
          appBaseUrl: "http://127.0.0.1:3400",
        })),
      },
    )

    expect(exitCode).toBe(1)
    expect(stdout).toEqual([])
    expect(stderr).toEqual(["Selected output is empty."])
  })
})
