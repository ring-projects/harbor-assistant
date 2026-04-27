import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  DockerSandboxProvider,
  logDockerSandboxReadiness,
} from "./docker-sandbox-provider"

describe("DockerSandboxProvider", () => {
  const tempRoots = new Set<string>()

  afterEach(async () => {
    for (const rootPath of tempRoots) {
      await rm(rootPath, { recursive: true, force: true })
      tempRoots.delete(rootPath)
    }
  })

  it("creates an sbx sandbox for a prepared workspace directory", async () => {
    const runtimeRoot = await mkdtemp(
      path.join(os.tmpdir(), "harbor-docker-sandbox-"),
    )
    tempRoots.add(runtimeRoot)
    const workspaceRoot = path.join(runtimeRoot, "source")
    await mkdir(workspaceRoot, { recursive: true })
    await writeFile(
      path.join(workspaceRoot, "README.md"),
      "workspace\n",
      "utf8",
    )

    const runCli = vi.fn(async () => ({
      exitCode: 0,
      stdout: "",
      stderr: "",
    }))
    const provider = new DockerSandboxProvider(
      path.join(runtimeRoot, "sandboxes"),
      runCli,
    )

    const sandbox = await provider.createSandbox({
      source: {
        type: "directory",
        path: workspaceRoot,
      },
      profile: {
        vcpuCount: 2,
        memoryMb: 4096,
        idleTimeoutSeconds: 300,
        maxDurationSeconds: 1800,
      },
      networkPolicy: {
        outboundMode: "allow-list",
        allowedHosts: ["registry.npmjs.org"],
      },
      metadata: {
        workspaceId: null,
        projectId: "project-1",
        taskId: "task-1",
        purpose: "task-run",
        labels: {},
      },
    })

    expect(runCli).toHaveBeenCalledWith(
      expect.arrayContaining([
        "create",
        "--name",
        sandbox.providerSandboxId,
        "shell",
      ]),
    )
    expect(runCli).toHaveBeenCalledWith(
      expect.arrayContaining([
        sandbox.workingDirectory,
        expect.stringMatching(/\/workspace\/harbor-assistant:ro$/),
      ]),
    )
    await expect(
      provider.readFile(sandbox.providerSandboxId, "README.md"),
    ).resolves.toBeInstanceOf(Uint8Array)
  })

  it("uses a saved sbx snapshot as the sandbox template source", async () => {
    const runtimeRoot = await mkdtemp(
      path.join(os.tmpdir(), "harbor-docker-sandbox-"),
    )
    tempRoots.add(runtimeRoot)
    const runCli = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: "",
      stderr: "",
    })

    const provider = new DockerSandboxProvider(
      path.join(runtimeRoot, "sandboxes"),
      runCli,
    )

    const created = await provider.createSandbox({
      source: {
        type: "empty",
      },
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
        workspaceId: null,
        projectId: "project-1",
        taskId: "task-1",
        purpose: "task-run",
        labels: {},
      },
    })

    await provider.writeFiles(created.providerSandboxId, [
      {
        path: "README.md",
        content: new TextEncoder().encode("template\n"),
      },
    ])

    const snapshot = await provider.createSnapshot(created.providerSandboxId)

    runCli.mockResolvedValueOnce({
      exitCode: 0,
      stdout: "",
      stderr: "",
    })

    const restored = await provider.createSandbox({
      source: {
        type: "snapshot",
        snapshotId: snapshot.providerSnapshotId,
      },
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
        workspaceId: null,
        projectId: "project-1",
        taskId: "task-2",
        purpose: "task-run",
        labels: {},
      },
    })

    const snapshotWorkspaceDirectory = path.join(
      runtimeRoot,
      "sandboxes",
      ".snapshots",
      snapshot.providerSnapshotId,
      "workspace",
    )
    const snapshotMetadataPath = path.join(
      runtimeRoot,
      "sandboxes",
      ".snapshots",
      snapshot.providerSnapshotId,
      "metadata.json",
    )

    await expect(access(snapshotWorkspaceDirectory)).resolves.toBeUndefined()
    await expect(access(snapshotMetadataPath)).resolves.toBeUndefined()
    await expect(
      readFile(path.join(restored.workingDirectory, "README.md"), "utf8"),
    ).resolves.toBe("template\n")
    expect(snapshot.providerSnapshotRef).toBe(
      `harbor-sbx-template:${snapshot.providerSnapshotId}`,
    )
    expect(runCli).toHaveBeenNthCalledWith(2, [
      "save",
      created.providerSandboxId,
      `harbor-sbx-template:${snapshot.providerSnapshotId}`,
    ])
    expect(runCli).toHaveBeenNthCalledWith(
      3,
      expect.arrayContaining([
        "create",
        "--name",
        restored.providerSandboxId,
        "-t",
        `harbor-sbx-template:${snapshot.providerSnapshotId}`,
      ]),
    )
  })

  it("logs sbx readiness when docker sandboxes runtime is available", async () => {
    const runCli = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "sbx version 0.14.1",
        stderr: "",
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "[]",
        stderr: "",
      })
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    }

    await logDockerSandboxReadiness({
      rootDirectory: "/tmp/harbor/sandboxes",
      logger,
      runCli,
    })

    expect(runCli).toHaveBeenNthCalledWith(1, ["version"])
    expect(runCli).toHaveBeenNthCalledWith(2, ["ls", "--json"])
    expect(logger.info).toHaveBeenCalledWith(
      "[harbor:sandbox] sbx cli ready version=sbx version 0.14.1",
    )
    expect(logger.info).toHaveBeenCalledWith(
      "[harbor:sandbox] docker sandboxes runtime ready root=/tmp/harbor/sandboxes agent=shell",
    )
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it("warns when sbx runtime checks fail", async () => {
    const runCli = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: "",
        stderr: "sbx: command not found",
      })
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: "",
        stderr: "sbx: command not found",
      })
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    }

    await logDockerSandboxReadiness({
      rootDirectory: "/tmp/harbor/sandboxes",
      logger,
      runCli,
    })

    expect(logger.info).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      "[harbor:sandbox] sbx cli check failed sbx: command not found",
    )
    expect(logger.warn).toHaveBeenCalledWith(
      "[harbor:sandbox] docker sandboxes runtime check failed sbx: command not found",
    )
  })

  it("publishes preview ports through sbx ports", async () => {
    const runtimeRoot = await mkdtemp(
      path.join(os.tmpdir(), "harbor-docker-sandbox-"),
    )
    tempRoots.add(runtimeRoot)
    const runCli = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "",
        stderr: "",
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "[]",
        stderr: "",
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "",
        stderr: "",
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify([
          {
            sandboxPort: 5173,
            hostIp: "127.0.0.1",
            hostPort: "49153",
            protocol: "tcp",
          },
        ]),
        stderr: "",
      })

    const provider = new DockerSandboxProvider(
      path.join(runtimeRoot, "sandboxes"),
      runCli,
    )

    const sandbox = await provider.createSandbox({
      source: {
        type: "empty",
      },
      profile: {
        vcpuCount: 2,
        memoryMb: 4096,
        idleTimeoutSeconds: 300,
        maxDurationSeconds: 1800,
      },
      networkPolicy: {
        outboundMode: "allow-all",
        allowedHosts: [],
      },
      metadata: {
        workspaceId: null,
        projectId: "project-1",
        taskId: "task-1",
        purpose: "preview",
        labels: {},
      },
    })

    await expect(
      provider.resolvePreviewUrl({
        providerSandboxId: sandbox.providerSandboxId,
        port: 5173,
      }),
    ).resolves.toBe("http://127.0.0.1:49153")

    expect(runCli).toHaveBeenNthCalledWith(2, [
      "ports",
      sandbox.providerSandboxId,
      "--json",
    ])
    expect(runCli).toHaveBeenNthCalledWith(3, [
      "ports",
      sandbox.providerSandboxId,
      "--publish",
      "5173",
    ])
    expect(runCli).toHaveBeenNthCalledWith(4, [
      "ports",
      sandbox.providerSandboxId,
      "--json",
    ])
  })
})
