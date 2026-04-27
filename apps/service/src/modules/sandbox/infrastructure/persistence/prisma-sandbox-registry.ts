import type { PrismaClient } from "@prisma/client"

import type { SandboxRegistry } from "../../application/sandbox-registry"
import type { SandboxCommandRecord } from "../../domain/sandbox-command"
import type { SandboxEnvironment } from "../../domain/sandbox"
import type { SandboxSnapshotRecord } from "../../domain/sandbox-snapshot"
import {
  toDomainSandbox,
  toDomainSandboxCommand,
  toDomainSandboxSnapshot,
} from "./sandbox-mapper"

export class PrismaSandboxRegistry implements SandboxRegistry {
  constructor(private readonly prisma: PrismaClient) {}

  async saveSandbox(sandbox: SandboxEnvironment) {
    await this.prisma.sandbox.upsert({
      where: {
        id: sandbox.id,
      },
      create: {
        id: sandbox.id,
        provider: sandbox.provider,
        providerSandboxId: sandbox.providerSandboxId,
        mode: sandbox.mode,
        status: sandbox.status,
        source: sandbox.source,
        workingDirectory: sandbox.workingDirectory,
        profile: sandbox.profile,
        networkPolicy: sandbox.networkPolicy,
        workspaceId: sandbox.metadata.workspaceId,
        projectId: sandbox.metadata.projectId,
        taskId: sandbox.metadata.taskId,
        purpose: sandbox.metadata.purpose,
        labels: sandbox.metadata.labels,
        previewBaseUrl: sandbox.previewBaseUrl,
        failureReason: sandbox.failureReason,
        createdAt: sandbox.createdAt,
        updatedAt: sandbox.updatedAt,
        lastReadyAt: sandbox.lastReadyAt,
        stoppedAt: sandbox.stoppedAt,
      },
      update: {
        provider: sandbox.provider,
        providerSandboxId: sandbox.providerSandboxId,
        mode: sandbox.mode,
        status: sandbox.status,
        source: sandbox.source,
        workingDirectory: sandbox.workingDirectory,
        profile: sandbox.profile,
        networkPolicy: sandbox.networkPolicy,
        workspaceId: sandbox.metadata.workspaceId,
        projectId: sandbox.metadata.projectId,
        taskId: sandbox.metadata.taskId,
        purpose: sandbox.metadata.purpose,
        labels: sandbox.metadata.labels,
        previewBaseUrl: sandbox.previewBaseUrl,
        failureReason: sandbox.failureReason,
        updatedAt: sandbox.updatedAt,
        lastReadyAt: sandbox.lastReadyAt,
        stoppedAt: sandbox.stoppedAt,
      },
    })
  }

  async findSandboxById(id: string) {
    const sandbox = await this.prisma.sandbox.findUnique({
      where: {
        id,
      },
    })

    return sandbox ? toDomainSandbox(sandbox) : null
  }

  async findSandboxByProviderId(providerSandboxId: string) {
    const sandbox = await this.prisma.sandbox.findUnique({
      where: {
        providerSandboxId,
      },
    })

    return sandbox ? toDomainSandbox(sandbox) : null
  }

  async listSandboxesByProject(projectId: string) {
    const sandboxes = await this.prisma.sandbox.findMany({
      where: {
        projectId,
      },
      orderBy: [{ createdAt: "desc" }],
    })

    return sandboxes.map(toDomainSandbox)
  }

  async saveCommand(command: SandboxCommandRecord) {
    await this.prisma.sandboxCommand.upsert({
      where: {
        id: command.id,
      },
      create: {
        id: command.id,
        sandboxId: command.sandboxId,
        providerCommandId: command.providerCommandId,
        command: command.command,
        cwd: command.cwd,
        detached: command.detached,
        status: command.status,
        exitCode: command.exitCode,
        errorMessage: command.errorMessage,
        createdAt: command.createdAt,
        updatedAt: command.updatedAt,
        startedAt: command.startedAt,
        finishedAt: command.finishedAt,
      },
      update: {
        providerCommandId: command.providerCommandId,
        command: command.command,
        cwd: command.cwd,
        detached: command.detached,
        status: command.status,
        exitCode: command.exitCode,
        errorMessage: command.errorMessage,
        updatedAt: command.updatedAt,
        startedAt: command.startedAt,
        finishedAt: command.finishedAt,
      },
    })
  }

  async findCommandById(id: string) {
    const command = await this.prisma.sandboxCommand.findUnique({
      where: {
        id,
      },
    })

    return command ? toDomainSandboxCommand(command) : null
  }

  async listCommandsBySandbox(sandboxId: string) {
    const commands = await this.prisma.sandboxCommand.findMany({
      where: {
        sandboxId,
      },
      orderBy: [{ createdAt: "desc" }],
    })

    return commands.map(toDomainSandboxCommand)
  }

  async saveSnapshot(snapshot: SandboxSnapshotRecord) {
    await this.prisma.sandboxSnapshot.upsert({
      where: {
        id: snapshot.id,
      },
      create: {
        id: snapshot.id,
        sandboxId: snapshot.sandboxId,
        providerSnapshotId: snapshot.providerSnapshotId,
        providerSnapshotRef: snapshot.providerSnapshotRef,
        createdAt: snapshot.createdAt,
      },
      update: {
        providerSnapshotId: snapshot.providerSnapshotId,
        providerSnapshotRef: snapshot.providerSnapshotRef,
      },
    })
  }

  async findSnapshotById(id: string) {
    const snapshot = await this.prisma.sandboxSnapshot.findUnique({
      where: {
        id,
      },
    })

    return snapshot ? toDomainSandboxSnapshot(snapshot) : null
  }

  async listSnapshotsBySandbox(sandboxId: string) {
    const snapshots = await this.prisma.sandboxSnapshot.findMany({
      where: {
        sandboxId,
      },
      orderBy: [{ createdAt: "desc" }],
    })

    return snapshots.map(toDomainSandboxSnapshot)
  }
}
