import type { SandboxCommandRecord } from "../domain/sandbox-command"
import type { SandboxEnvironment } from "../domain/sandbox"
import type { SandboxSnapshotRecord } from "../domain/sandbox-snapshot"
import type { SandboxRegistry } from "../application/sandbox-registry"

export class InMemorySandboxRegistry implements SandboxRegistry {
  private readonly sandboxes = new Map<string, SandboxEnvironment>()
  private readonly sandboxIdsByProviderId = new Map<string, string>()
  private readonly commands = new Map<string, SandboxCommandRecord>()
  private readonly snapshots = new Map<string, SandboxSnapshotRecord>()

  async saveSandbox(sandbox: SandboxEnvironment) {
    this.sandboxes.set(sandbox.id, sandbox)
    this.sandboxIdsByProviderId.set(sandbox.providerSandboxId, sandbox.id)
  }

  async findSandboxById(id: string) {
    return this.sandboxes.get(id) ?? null
  }

  async findSandboxByProviderId(providerSandboxId: string) {
    const sandboxId = this.sandboxIdsByProviderId.get(providerSandboxId)
    if (!sandboxId) {
      return null
    }

    return this.sandboxes.get(sandboxId) ?? null
  }

  async listSandboxesByProject(projectId: string) {
    return Array.from(this.sandboxes.values())
      .filter((sandbox) => sandbox.metadata.projectId === projectId)
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
  }

  async saveCommand(command: SandboxCommandRecord) {
    this.commands.set(command.id, command)
  }

  async findCommandById(id: string) {
    return this.commands.get(id) ?? null
  }

  async listCommandsBySandbox(sandboxId: string) {
    return Array.from(this.commands.values())
      .filter((command) => command.sandboxId === sandboxId)
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
  }

  async saveSnapshot(snapshot: SandboxSnapshotRecord) {
    this.snapshots.set(snapshot.id, snapshot)
  }

  async findSnapshotById(id: string) {
    return this.snapshots.get(id) ?? null
  }

  async listSnapshotsBySandbox(sandboxId: string) {
    return Array.from(this.snapshots.values())
      .filter((snapshot) => snapshot.sandboxId === sandboxId)
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
  }
}
