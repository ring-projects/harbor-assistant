import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

import { z } from "zod"

import type { AgentModel, AgentType } from "../types"

const customAgentModelSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).optional(),
})

const customAgentModelsEntrySchema = z.object({
  defaultModel: z.string().min(1).nullable().optional(),
  models: z.array(customAgentModelSchema).default([]),
})

const customAgentModelsSchema = z.object({
  codex: customAgentModelsEntrySchema.optional(),
  "claude-code": customAgentModelsEntrySchema.optional(),
})

export type CustomAgentModelsConfig = z.infer<typeof customAgentModelsSchema>

function getBundledAgentModelsPath() {
  return path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "default-agent-models.json",
  )
}

export async function readCustomAgentModelsConfig(): Promise<CustomAgentModelsConfig | null> {
  try {
    const content = await readFile(getBundledAgentModelsPath(), "utf8")
    const parsed = customAgentModelsSchema.safeParse(JSON.parse(content))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function mergeAgentModelsWithCustomConfig(args: {
  agentType: AgentType
  models: AgentModel[]
  customConfig: CustomAgentModelsConfig | null
}): AgentModel[] {
  const customEntry = args.customConfig?.[args.agentType]
  if (!customEntry) {
    return args.models
  }

  const byId = new Map<string, AgentModel>()

  for (const model of args.models) {
    byId.set(model.id, model)
  }

  for (const model of customEntry.models) {
    const existing = byId.get(model.id)
    byId.set(model.id, {
      id: model.id,
      displayName: model.displayName ?? existing?.displayName ?? model.id,
      isDefault: existing?.isDefault ?? false,
    })
  }

  const customDefaultModel = customEntry.defaultModel?.trim() || null
  if (customDefaultModel) {
    const existing = byId.get(customDefaultModel)
    byId.set(customDefaultModel, {
      id: customDefaultModel,
      displayName: existing?.displayName ?? customDefaultModel,
      isDefault: true,
    })
  }

  const merged = Array.from(byId.values())
  if (!customDefaultModel) {
    return merged
  }

  return merged.map((model) => ({
    ...model,
    isDefault: model.id === customDefaultModel,
  }))
}
