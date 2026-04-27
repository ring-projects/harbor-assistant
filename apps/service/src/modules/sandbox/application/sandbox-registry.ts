import type { SandboxCommandRecord } from "../domain/sandbox-command"
import type { SandboxEnvironment } from "../domain/sandbox"
import type { SandboxSnapshotRecord } from "../domain/sandbox-snapshot"

export interface SandboxRegistry {
  saveSandbox(sandbox: SandboxEnvironment): Promise<void>
  findSandboxById(id: string): Promise<SandboxEnvironment | null>
  findSandboxByProviderId(
    providerSandboxId: string,
  ): Promise<SandboxEnvironment | null>
  listSandboxesByProject(projectId: string): Promise<SandboxEnvironment[]>

  saveCommand(command: SandboxCommandRecord): Promise<void>
  findCommandById(id: string): Promise<SandboxCommandRecord | null>
  listCommandsBySandbox(sandboxId: string): Promise<SandboxCommandRecord[]>

  saveSnapshot(snapshot: SandboxSnapshotRecord): Promise<void>
  findSnapshotById(id: string): Promise<SandboxSnapshotRecord | null>
  listSnapshotsBySandbox(sandboxId: string): Promise<SandboxSnapshotRecord[]>
}
