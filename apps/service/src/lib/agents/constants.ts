/**
 * Agent command candidates
 */
export const AGENT_COMMANDS = {
  codex: ["codex"],
  "claude-code": ["claudecode", "claude"],
} as const

/**
 * Codex configuration file path
 */
export const CODEX_CONFIG_PATH = ".codex/config.toml"

/**
 * Codex skills directory path
 */
export const CODEX_SKILLS_PATH = ".codex/skills"

/**
 * Default Codex command
 */
export const DEFAULT_CODEX_COMMAND = AGENT_COMMANDS.codex[0]

/**
 * Maximum captured output length
 */
export const MAX_CAPTURED_OUTPUT_LENGTH = 200_000
