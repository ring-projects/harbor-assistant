import type { ExecutorIdConstant } from "../../constants/executors"

export type ExecutorId = ExecutorIdConstant

export type ExecutorModelSource = "app-server" | "config"

export type ExecutorModelItem = {
  model: string
  displayName: string
  isDefault: boolean
}

export type ExecutorModelsCapability =
  | {
      status: "ok"
      source: ExecutorModelSource
      items: ExecutorModelItem[]
    }
  | {
      status: "error" | "not_installed"
      source: ExecutorModelSource | null
      items: ExecutorModelItem[]
      error: string
    }

export type ExecutorCapability = {
  installed: boolean
  version: string | null
  models?: ExecutorModelsCapability
}

export type ExecutorCapabilityMap = Record<ExecutorId, ExecutorCapability>

export type ExecutorCapabilityResult = {
  checkedAt: string
  executors: ExecutorCapabilityMap
  availableExecutors: ExecutorId[]
}
