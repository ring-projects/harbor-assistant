export const EXECUTOR_IDS = ["codex", "opencode", "claudcode"] as const

export type ExecutorIdConstant = (typeof EXECUTOR_IDS)[number]

export const EXECUTOR_COMMAND_CANDIDATES: Record<
  ExecutorIdConstant,
  readonly string[]
> = {
  codex: ["codex"],
  opencode: ["opencode"],
  claudcode: ["claudcode", "claude"],
}

export const CODEX_COMMAND_CANDIDATES = EXECUTOR_COMMAND_CANDIDATES.codex
export const DEFAULT_CODEX_COMMAND = CODEX_COMMAND_CANDIDATES[0]
