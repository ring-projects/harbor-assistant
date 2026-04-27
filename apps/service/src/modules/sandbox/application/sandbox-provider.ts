import type {
  SandboxComputeProfile,
  SandboxMetadata,
  SandboxNetworkPolicy,
  SandboxProvider,
  SandboxSource,
} from "../domain/sandbox"

export type SandboxFileInput = {
  path: string
  content: Uint8Array
}

export type SandboxCommand = {
  providerCommandId: string
  command: string
  cwd: string | null
  detached: boolean
  startedAt: Date | null
}

export interface SandboxCommandHandle {
  readonly providerCommandId: string
  logs(): AsyncIterable<string>
  wait(): Promise<{
    exitCode: number | null
  }>
  kill(): Promise<void>
}

export interface SandboxProvisioningPort {
  readonly provider: SandboxProvider

  createSandbox(input: {
    source: SandboxSource
    workingDirectory?: string | null
    profile: SandboxComputeProfile
    networkPolicy: SandboxNetworkPolicy
    metadata: SandboxMetadata
  }): Promise<{
    providerSandboxId: string
    workingDirectory: string
    previewBaseUrl?: string | null
  }>

  destroySandbox(providerSandboxId: string): Promise<void>

  createSnapshot(providerSandboxId: string): Promise<{
    providerSnapshotId: string
    providerSnapshotRef?: string | null
  }>

  writeFiles(
    providerSandboxId: string,
    files: SandboxFileInput[],
  ): Promise<void>

  readFile(providerSandboxId: string, path: string): Promise<Uint8Array>

  runCommand(input: {
    providerSandboxId: string
    command: string
    cwd?: string | null
    env?: Record<string, string>
    detached?: boolean
  }): Promise<SandboxCommand>

  getCommand(input: {
    providerSandboxId: string
    providerCommandId: string
  }): Promise<SandboxCommandHandle | null>

  resolvePreviewUrl(input: {
    providerSandboxId: string
    port: number
  }): Promise<string>
}
