import type {
  AgentCapabilityResult,
  AgentRegistration,
  AgentType,
  IAgentCapabilityProvider,
  IAgentRegistry,
  IAgentRuntime,
} from "./types"
import { codexAdapter } from "./adapters/codex"
import { claudeCodeAdapter } from "./adapters/claude-code"
import { getCodexCapabilities } from "./capabilities/codex"
import { getClaudeCodeCapabilities } from "./capabilities/claude-code"

function createCapabilityProvider(args: {
  type: AgentType
  inspect: () => Promise<
    ReturnType<IAgentCapabilityProvider["inspect"]> extends Promise<infer T>
      ? T
      : never
  >
}): IAgentCapabilityProvider {
  return {
    type: args.type,
    inspect: args.inspect,
  }
}

const DEFAULT_AGENT_REGISTRATIONS: AgentRegistration[] = [
  {
    type: "codex",
    runtime: codexAdapter,
    capability: createCapabilityProvider({
      type: "codex",
      inspect: getCodexCapabilities,
    }),
  },
  {
    type: "claude-code",
    runtime: claudeCodeAdapter,
    capability: createCapabilityProvider({
      type: "claude-code",
      inspect: getClaudeCodeCapabilities,
    }),
  },
]

export class AgentFactory implements IAgentRegistry {
  private static readonly defaultRegistry = new AgentFactory(
    DEFAULT_AGENT_REGISTRATIONS,
  )

  private readonly registrations: AgentRegistration[]
  private readonly registrationsByType: Map<AgentType, AgentRegistration>

  constructor(registrations: AgentRegistration[]) {
    this.registrations = []
    this.registrationsByType = new Map()

    for (const registration of registrations) {
      if (registration.runtime.type !== registration.type) {
        throw new Error(
          `Runtime type mismatch: registration declares "${registration.type}" but runtime exposes "${registration.runtime.type}".`,
        )
      }

      if (registration.capability.type !== registration.type) {
        throw new Error(
          `Capability type mismatch: registration declares "${registration.type}" but capability exposes "${registration.capability.type}".`,
        )
      }

      if (this.registrationsByType.has(registration.type)) {
        throw new Error(
          `Duplicate agent registration for type "${registration.type}".`,
        )
      }

      this.registrations.push(registration)
      this.registrationsByType.set(registration.type, registration)
    }
  }

  has(type: AgentType): boolean {
    return this.registrationsByType.has(type)
  }

  get(type: AgentType): AgentRegistration {
    const registration = this.registrationsByType.get(type)
    if (!registration) {
      throw new Error(
        `Unknown agent type "${type}". Available types: ${this.listTypes().join(", ") || "(none)"}.`,
      )
    }
    return registration
  }

  getRuntime(type: AgentType): IAgentRuntime {
    return this.get(type).runtime
  }

  getCapability(type: AgentType): IAgentCapabilityProvider {
    return this.get(type).capability
  }

  list(): AgentRegistration[] {
    return [...this.registrations]
  }

  listTypes(): AgentType[] {
    return this.registrations.map((registration) => registration.type)
  }

  async inspectAll(): Promise<AgentCapabilityResult> {
    const agents = {} as Record<
      AgentType,
      Awaited<ReturnType<IAgentCapabilityProvider["inspect"]>>
    >

    for (const registration of this.registrations) {
      const capabilities = await registration.capability.inspect()
      agents[registration.type] = capabilities
    }

    return {
      checkedAt: new Date(),
      agents,
    }
  }

  static has(type: AgentType): boolean {
    return this.defaultRegistry.has(type)
  }

  static get(type: AgentType): AgentRegistration {
    return this.defaultRegistry.get(type)
  }

  static getRuntime(type: AgentType): IAgentRuntime {
    return this.defaultRegistry.getRuntime(type)
  }

  static getCapability(type: AgentType): IAgentCapabilityProvider {
    return this.defaultRegistry.getCapability(type)
  }

  static list(): AgentRegistration[] {
    return this.defaultRegistry.list()
  }

  static listTypes(): AgentType[] {
    return this.defaultRegistry.listTypes()
  }

  static inspectAll(): Promise<AgentCapabilityResult> {
    return this.defaultRegistry.inspectAll()
  }

  static getAgent(type: AgentType): IAgentRuntime {
    return this.getRuntime(type)
  }

  static getAvailableTypes(): AgentType[] {
    return this.listTypes()
  }
}
