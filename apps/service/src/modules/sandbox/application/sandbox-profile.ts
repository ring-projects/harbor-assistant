import type {
  SandboxComputeProfile,
  SandboxMode,
  SandboxNetworkPolicy,
} from "../domain/sandbox"

export const SANDBOX_PROFILE_PRESETS: Record<
  SandboxMode,
  SandboxComputeProfile
> = {
  safe: {
    vcpuCount: 2,
    memoryMb: 4096,
    idleTimeoutSeconds: 300,
    maxDurationSeconds: 1800,
  },
  connected: {
    vcpuCount: 2,
    memoryMb: 4096,
    idleTimeoutSeconds: 300,
    maxDurationSeconds: 3600,
  },
  "full-access": {
    vcpuCount: 4,
    memoryMb: 8192,
    idleTimeoutSeconds: 300,
    maxDurationSeconds: 7200,
  },
}

export const SANDBOX_NETWORK_POLICY_PRESETS: Record<
  SandboxMode,
  SandboxNetworkPolicy
> = {
  safe: {
    outboundMode: "deny-all",
    allowedHosts: [],
  },
  connected: {
    outboundMode: "allow-list",
    allowedHosts: [],
  },
  "full-access": {
    outboundMode: "allow-all",
    allowedHosts: [],
  },
}

export function resolveSandboxProfile(mode: SandboxMode) {
  return SANDBOX_PROFILE_PRESETS[mode]
}

export function resolveSandboxNetworkPolicy(mode: SandboxMode) {
  const preset = SANDBOX_NETWORK_POLICY_PRESETS[mode]
  return {
    ...preset,
    allowedHosts: [...preset.allowedHosts],
  } satisfies SandboxNetworkPolicy
}
