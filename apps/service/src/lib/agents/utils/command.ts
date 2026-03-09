import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const VERSION_ARGS: readonly string[][] = [
  ["--version"],
  ["version"],
  ["-v"],
]

function getCommandLocator() {
  return process.platform === "win32" ? "where" : "which"
}

function extractFirstLine(output: string) {
  return (
    output
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find((value) => value.length > 0) ?? null
  )
}

function readErrorOutput(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return ""
  }

  const stdout =
    "stdout" in error && typeof error.stdout === "string" ? error.stdout : ""
  const stderr =
    "stderr" in error && typeof error.stderr === "string" ? error.stderr : ""

  return `${stdout}\n${stderr}`.trim()
}

/**
 * Check if a command is available
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(getCommandLocator(), [command], {
      timeout: 1_000,
      windowsHide: true,
    })

    return stdout.trim().length > 0
  } catch {
    return false
  }
}

/**
 * Find an installed command from a list of candidates
 */
export async function findInstalledCommand(
  candidates: readonly string[],
): Promise<string | null> {
  for (const command of candidates) {
    if (await isCommandAvailable(command)) {
      return command
    }
  }

  return null
}

/**
 * Resolve command version
 */
export async function resolveCommandVersion(
  command: string,
): Promise<string | null> {
  for (const args of VERSION_ARGS) {
    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        timeout: 1_500,
        maxBuffer: 64 * 1024,
        windowsHide: true,
      })

      const version = extractFirstLine(`${stdout}\n${stderr}`)
      if (version) {
        return version
      }
    } catch (error) {
      const version = extractFirstLine(readErrorOutput(error))
      if (version) {
        return version
      }
    }
  }

  return null
}
