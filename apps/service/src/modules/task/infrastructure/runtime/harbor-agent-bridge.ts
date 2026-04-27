import { chmod, cp, lstat, mkdir, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import type { AgentInput } from "../../../../lib/agents"

function getServiceRootDirectory() {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../../",
  )
}

function escapeShellSingleQuotes(value: string) {
  return value.replace(/'/g, `'\\''`)
}

async function pathExists(pathname: string) {
  try {
    await lstat(pathname)
    return true
  } catch {
    return false
  }
}

async function ensureHarborCliWrapper(args: { workingDirectory: string }) {
  const serviceRootDirectory = getServiceRootDirectory()
  const binDirectory = path.join(args.workingDirectory, ".harbor", "bin")
  const wrapperPath = path.join(binDirectory, "harbor")

  await mkdir(binDirectory, { recursive: true })

  const wrapperContent = [
    "#!/bin/sh",
    "set -eu",
    `SERVICE_ROOT='${escapeShellSingleQuotes(serviceRootDirectory)}'`,
    'if [ -f "$SERVICE_ROOT/dist/cli.js" ]; then',
    '  exec node "$SERVICE_ROOT/dist/cli.js" "$@"',
    "fi",
    'exec node --import tsx "$SERVICE_ROOT/src/cli.ts" "$@"',
    "",
  ].join("\n")

  await writeFile(wrapperPath, wrapperContent, "utf8")
  await chmod(wrapperPath, 0o755)

  return {
    binDirectory,
    wrapperPath,
  }
}

async function ensureHarborSkillsMounted(args: {
  workingDirectory: string
  publicSkillsRootDirectory?: string
}) {
  if (!args.publicSkillsRootDirectory) {
    return {
      mountedSkillNames: [] as string[],
      mountedSkillsDirectory: null as string | null,
    }
  }

  const sourceRoot = path.resolve(args.publicSkillsRootDirectory)

  const sourceEntries = await readdir(sourceRoot, {
    withFileTypes: true,
  }).catch(() => [])
  const mountedSkillNames = sourceEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  if (mountedSkillNames.length === 0) {
    return {
      mountedSkillNames,
      mountedSkillsDirectory: null as string | null,
    }
  }

  const mountedSkillsDirectory = path.join(
    args.workingDirectory,
    ".codex",
    "skills",
  )
  await mkdir(mountedSkillsDirectory, { recursive: true })

  for (const skillName of mountedSkillNames) {
    const sourcePath = path.join(sourceRoot, skillName)
    const targetPath = path.join(mountedSkillsDirectory, skillName)
    if (await pathExists(targetPath)) {
      continue
    }

    try {
      await cp(sourcePath, targetPath, {
        recursive: true,
        force: false,
      })
    } catch {
      // If mount/copy fails for one skill, continue with the rest.
    }
  }

  return {
    mountedSkillNames,
    mountedSkillsDirectory,
  }
}

function buildHarborRuntimeBridgeText(args: {
  projectId: string
  taskId: string
  orchestrationId: string | null
  mountedSkillNames: string[]
}) {
  const lines = [
    "Harbor runtime context:",
    "- Use the Harbor CLI for Harbor-specific task, orchestration, file, and git operations.",
    "- The `harbor` command is available on PATH and already uses the current Harbor auth context.",
    `- Current project: ${args.projectId}`,
    `- Current task: ${args.taskId}`,
  ]

  if (args.orchestrationId) {
    lines.push(`- Current orchestration: ${args.orchestrationId}`)
  }

  lines.push(
    "- Common commands:",
    "  - `harbor auth whoami`",
    '  - `harbor task title set --id "$HARBOR_TASK_ID" --title "Short title"`',
    '  - `harbor task events --id "$HARBOR_TASK_ID" --limit 100`',
    '  - `harbor files list --project "$HARBOR_PROJECT_ID"`',
    '  - `harbor files read --project "$HARBOR_PROJECT_ID" --path "..."`',
    '  - `harbor files write --project "$HARBOR_PROJECT_ID" --path "..." --content-file "..."`',
    '  - `harbor git diff --project "$HARBOR_PROJECT_ID"`',
  )

  if (args.orchestrationId) {
    lines.push(
      '  - `harbor orchestration task create --id "$HARBOR_ORCHESTRATION_ID" ...`',
    )
  }

  if (args.mountedSkillNames.length > 0) {
    lines.push(
      `- Harbor public skills are mounted in .codex/skills: ${args.mountedSkillNames.join(", ")}`,
      "- Prefer the Harbor CLI skill guidance for Harbor-specific workflows.",
    )
  }

  return lines.join("\n")
}

export async function prepareHarborAgentBridge(args: {
  projectId: string
  taskId: string
  orchestrationId: string | null
  workingDirectory: string
  baseEnv?: Record<string, string>
  publicSkillsRootDirectory?: string
}) {
  const { binDirectory, wrapperPath } = await ensureHarborCliWrapper({
    workingDirectory: args.workingDirectory,
  })
  const skills = await ensureHarborSkillsMounted({
    workingDirectory: args.workingDirectory,
    publicSkillsRootDirectory: args.publicSkillsRootDirectory,
  })

  const currentPath = args.baseEnv?.PATH?.trim() || process.env.PATH || ""
  const env: Record<string, string> = {
    ...(args.baseEnv ?? {}),
    PATH: currentPath ? `${binDirectory}:${currentPath}` : binDirectory,
    HARBOR_CLI: "harbor",
    HARBOR_CLI_PATH: wrapperPath,
  }

  const preamble = buildHarborRuntimeBridgeText({
    projectId: args.projectId,
    taskId: args.taskId,
    orchestrationId: args.orchestrationId,
    mountedSkillNames: skills.mountedSkillNames,
  })

  return {
    env,
    preamble,
    mountedSkillsDirectory: skills.mountedSkillsDirectory,
    mountedSkillNames: skills.mountedSkillNames,
  }
}

export function prependHarborAgentBridgeText(
  input: AgentInput,
  preamble: string,
): AgentInput {
  const normalizedPreamble = preamble.trim()
  if (!normalizedPreamble) {
    return input
  }

  if (typeof input === "string") {
    return `${normalizedPreamble}\n\n${input}`
  }

  return [
    {
      type: "text",
      text: normalizedPreamble,
    },
    ...input,
  ]
}
