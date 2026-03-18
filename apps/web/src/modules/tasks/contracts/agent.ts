import { z } from "zod"

export const agentModelSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  isDefault: z.boolean(),
})

export const agentCapabilitiesSchema = z.object({
  installed: z.boolean(),
  version: z.string().nullable(),
  models: z.array(agentModelSchema),
  supportsResume: z.boolean(),
  supportsStreaming: z.boolean(),
})

export const agentCapabilityResultSchema = z.object({
  checkedAt: z.string(),
  availableAgents: z.array(z.enum(["codex", "claude-code"])),
  agents: z.object({
    codex: agentCapabilitiesSchema,
    "claude-code": agentCapabilitiesSchema,
  }),
})

export type AgentModel = z.infer<typeof agentModelSchema>
export type AgentCapabilities = z.infer<typeof agentCapabilitiesSchema>
export type AgentCapabilityResult = z.infer<typeof agentCapabilityResultSchema>
