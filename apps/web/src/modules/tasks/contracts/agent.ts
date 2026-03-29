import { z } from "zod"

import { taskEffortSchema } from "./task"

export const agentModelSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  isDefault: z.boolean(),
  efforts: z.array(taskEffortSchema).default([]),
})

export const agentCapabilitiesSchema = z.object({
  models: z.array(agentModelSchema),
  supportsResume: z.boolean(),
  supportsStreaming: z.boolean(),
})

export const agentCapabilityResultSchema = z.object({
  checkedAt: z.string(),
  agents: z.object({
    codex: agentCapabilitiesSchema,
    "claude-code": agentCapabilitiesSchema,
  }),
})

export type AgentModel = z.infer<typeof agentModelSchema>
export type AgentCapabilities = z.infer<typeof agentCapabilitiesSchema>
export type AgentCapabilityResult = z.infer<typeof agentCapabilityResultSchema>
