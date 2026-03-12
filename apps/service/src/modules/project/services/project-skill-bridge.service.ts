import {
  access,
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import path from "node:path"

import type { ProjectRepository } from "../repositories"
import { createProjectError } from "../errors"

const HARBOR_GIT_EXCLUDE_START = "# >>> harbor skills >>>"
const HARBOR_GIT_EXCLUDE_END = "# <<< harbor skills <<<"
const HARBOR_SKILL_PREFIX = "harbor-"
const DEFAULT_HARBOR_SKILL_PROFILE = "default"

type ProjectSkillBridgeState = {
  enabled: boolean
  projectCodexSkillsDirectory: string
  harborProjectSkillRoot: string
  linkedSkillNames: string[]
}

function normalizeProfile(profile: string | null | undefined) {
  const normalized = profile?.trim()
  return normalized || DEFAULT_HARBOR_SKILL_PROFILE
}

async function exists(pathname: string) {
  try {
    await access(pathname)
    return true
  } catch {
    return false
  }
}

async function resolveGitDirectory(projectPath: string) {
  const projectGitPath = path.join(projectPath, ".git")
  const gitStats = await lstat(projectGitPath).catch(() => null)
  if (!gitStats) {
    return null
  }

  if (gitStats.isDirectory()) {
    return projectGitPath
  }

  if (!gitStats.isFile()) {
    return null
  }

  const raw = await readFile(projectGitPath, "utf8")
  const match = raw.match(/^gitdir:\s*(.+)\s*$/im)
  if (!match) {
    return null
  }

  const gitDir = match[1]?.trim()
  if (!gitDir) {
    return null
  }

  return path.isAbsolute(gitDir)
    ? path.resolve(gitDir)
    : path.resolve(projectPath, gitDir)
}

async function listSkillEntries(rootPath: string) {
  if (!(await exists(rootPath))) {
    return []
  }

  const entries = await readdir(rootPath, {
    withFileTypes: true,
  })

  return entries
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => entry.name)
    .filter(Boolean)
    .sort()
}

async function ensureSymlink(linkPath: string, targetPath: string) {
  const existingStats = await lstat(linkPath).catch(() => null)
  if (existingStats?.isSymbolicLink()) {
    const existingTarget = await readlink(linkPath).catch(() => null)
    if (
      existingTarget &&
      path.resolve(path.dirname(linkPath), existingTarget) === path.resolve(targetPath)
    ) {
      return
    }
  }

  if (existingStats) {
    await rm(linkPath, { recursive: true, force: true })
  }

  await mkdir(path.dirname(linkPath), { recursive: true })
  await symlink(targetPath, linkPath, "dir")
}

async function syncHarborExcludeBlock(projectPath: string, enabled: boolean) {
  const gitDirectory = await resolveGitDirectory(projectPath)
  if (!gitDirectory) {
    return
  }

  const excludePath = path.join(gitDirectory, "info", "exclude")
  await mkdir(path.dirname(excludePath), { recursive: true })

  const existing = (await readFile(excludePath, "utf8").catch(() => "")).replaceAll(
    "\r\n",
    "\n",
  )

  const block = [
    HARBOR_GIT_EXCLUDE_START,
    `.codex/skills/${HARBOR_SKILL_PREFIX}*`,
    HARBOR_GIT_EXCLUDE_END,
  ].join("\n")

  const blockPattern = new RegExp(
    `\\n?${HARBOR_GIT_EXCLUDE_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${HARBOR_GIT_EXCLUDE_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`,
    "g",
  )

  const withoutBlock = existing.replace(blockPattern, "").trimEnd()
  const next = enabled
    ? [withoutBlock, block].filter(Boolean).join("\n\n")
    : withoutBlock

  const normalizedNext = next ? `${next}\n` : ""
  if (normalizedNext === existing) {
    return
  }

  await writeFile(excludePath, normalizedNext, "utf8")
}

export function createProjectSkillBridgeService(args: {
  harborHomeDirectory: string
  projectRepository: Pick<ProjectRepository, "getProjectById">
}) {
  function getHarborProfileSkillRoot(profile: string | null | undefined) {
    return path.join(
      args.harborHomeDirectory,
      "skills",
      "profiles",
      normalizeProfile(profile),
    )
  }

  function getHarborProjectSkillRoot(projectId: string) {
    return path.join(args.harborHomeDirectory, "projects", projectId, "skills")
  }

  function getProjectCodexSkillsDirectory(projectPath: string) {
    return path.join(projectPath, ".codex", "skills")
  }

  function getHarborBridgeName(skillName: string) {
    return `${HARBOR_SKILL_PREFIX}${skillName}`
  }

  async function syncProjectSkillSource(args: {
    projectId: string
    profile: string | null | undefined
  }) {
    const profileRoot = getHarborProfileSkillRoot(args.profile)
    const projectRoot = getHarborProjectSkillRoot(args.projectId)

    await mkdir(profileRoot, { recursive: true })
    await mkdir(projectRoot, { recursive: true })

    const profileSkillNames = await listSkillEntries(profileRoot)
    const existingProjectSkillNames = await listSkillEntries(projectRoot)

    for (const skillName of existingProjectSkillNames) {
      if (!profileSkillNames.includes(skillName)) {
        await rm(path.join(projectRoot, skillName), {
          recursive: true,
          force: true,
        })
      }
    }

    for (const skillName of profileSkillNames) {
      await ensureSymlink(
        path.join(projectRoot, skillName),
        path.join(profileRoot, skillName),
      )
    }

    return {
      profileRoot,
      projectRoot,
      skillNames: profileSkillNames,
    }
  }

  async function ensureProjectSkillBridge(args: {
    projectId: string
    profile?: string | null
  }): Promise<ProjectSkillBridgeState> {
    const project = await argsProject(args.projectId)
    const synced = await syncProjectSkillSource({
      projectId: project.id,
      profile: args.profile,
    })

    const projectCodexSkillsDirectory = getProjectCodexSkillsDirectory(project.path)
    await mkdir(projectCodexSkillsDirectory, { recursive: true })

    const existingBridgeSkillNames = await listSkillEntries(projectCodexSkillsDirectory)
    const managedBridgeNames = existingBridgeSkillNames.filter((name) =>
      name.startsWith(HARBOR_SKILL_PREFIX),
    )

    for (const bridgeName of managedBridgeNames) {
      const skillName = bridgeName.slice(HARBOR_SKILL_PREFIX.length)
      if (!synced.skillNames.includes(skillName)) {
        await rm(path.join(projectCodexSkillsDirectory, bridgeName), {
          recursive: true,
          force: true,
        })
      }
    }

    for (const skillName of synced.skillNames) {
      await ensureSymlink(
        path.join(projectCodexSkillsDirectory, getHarborBridgeName(skillName)),
        path.join(synced.projectRoot, skillName),
      )
    }

    await syncHarborExcludeBlock(project.path, true)

    return {
      enabled: true,
      projectCodexSkillsDirectory,
      harborProjectSkillRoot: synced.projectRoot,
      linkedSkillNames: synced.skillNames,
    }
  }

  async function removeProjectSkillBridge(projectId: string) {
    const project = await argsProject(projectId)
    await removeProjectSkillBridgeAtProjectPath(project.path)
  }

  async function removeProjectSkillBridgeAtProjectPath(projectPath: string) {
    const projectCodexSkillsDirectory = getProjectCodexSkillsDirectory(projectPath)
    if (await exists(projectCodexSkillsDirectory)) {
      const entries = await listSkillEntries(projectCodexSkillsDirectory)
      for (const entry of entries) {
        if (!entry.startsWith(HARBOR_SKILL_PREFIX)) {
          continue
        }

        await rm(path.join(projectCodexSkillsDirectory, entry), {
          recursive: true,
          force: true,
        })
      }
    }

    await syncHarborExcludeBlock(projectPath, false)
  }

  function getProjectSkillAccessDirectories(projectId: string) {
    return [getHarborProjectSkillRoot(projectId)]
  }

  async function getProjectSkillBridgeState(args: {
    projectId: string
    profile?: string | null
  }): Promise<ProjectSkillBridgeState> {
    const project = await argsProject(args.projectId)
    const projectCodexSkillsDirectory = getProjectCodexSkillsDirectory(project.path)
    const harborProjectSkillRoot = getHarborProjectSkillRoot(project.id)
    const skillNames = await listSkillEntries(projectCodexSkillsDirectory)

    return {
      enabled: true,
      projectCodexSkillsDirectory,
      harborProjectSkillRoot,
      linkedSkillNames: skillNames
        .filter((name) => name.startsWith(HARBOR_SKILL_PREFIX))
        .map((name) => name.slice(HARBOR_SKILL_PREFIX.length)),
    }
  }

  async function argsProject(projectId: string) {
    const normalizedProjectId = projectId.trim()
    if (!normalizedProjectId) {
      throw createProjectError.invalidProjectId("Project ID is required")
    }

    const project = await args.projectRepository.getProjectById(normalizedProjectId)
    if (!project) {
      throw createProjectError.projectNotFound(normalizedProjectId)
    }

    return project
  }

  return {
    ensureProjectSkillBridge,
    removeProjectSkillBridge,
    removeProjectSkillBridgeAtProjectPath,
    getProjectSkillAccessDirectories,
    getProjectSkillBridgeState,
  }
}

export type ProjectSkillBridgeService = ReturnType<
  typeof createProjectSkillBridgeService
>
