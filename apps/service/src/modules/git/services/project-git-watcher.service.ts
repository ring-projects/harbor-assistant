import path from "node:path"
import { watch, type FSWatcher } from "chokidar"

import type { ProjectRepository } from "../../project"
import { createGitError } from "../errors"

export type ProjectGitChangeEvent = {
  projectId: string
  changedAt: string
}

export type ProjectGitWatcherListener = (event: ProjectGitChangeEvent) => void

export type ProjectGitWatcher = {
  subscribe: (
    projectId: string,
    listener: ProjectGitWatcherListener,
  ) => Promise<() => Promise<void>>
  close: () => Promise<void>
}

type ProjectGitWatcherEntry = {
  projectId: string
  watcher: FSWatcher
  listeners: Set<ProjectGitWatcherListener>
  debounceTimer: ReturnType<typeof setTimeout> | null
}

type WatchFactory = typeof watch

const WATCHER_DEBOUNCE_MS = 250
const WATCHER_EVENT_NAMES = [
  "add",
  "addDir",
  "change",
  "unlink",
  "unlinkDir",
] as const

function normalizeFsPath(value: string) {
  return path.resolve(value)
}

function createIgnoredMatcher(projectPath: string) {
  const projectRoot = normalizeFsPath(projectPath)
  const allowedGitPaths = new Set([
    normalizeFsPath(path.join(projectRoot, ".git", "HEAD")),
    normalizeFsPath(path.join(projectRoot, ".git", "index")),
  ])

  return (watchPath: string) => {
    const normalizedPath = normalizeFsPath(watchPath)
    if (allowedGitPaths.has(normalizedPath)) {
      return false
    }

    const relativePath = path.relative(projectRoot, normalizedPath)
    if (!relativePath || relativePath === ".") {
      return false
    }

    const normalizedRelativePath = relativePath.replaceAll("\\", "/")
    const segments = normalizedRelativePath.split("/")

    return segments.includes(".git") || segments.includes("node_modules")
  }
}

async function closeWatcherEntry(entry: ProjectGitWatcherEntry) {
  if (entry.debounceTimer) {
    clearTimeout(entry.debounceTimer)
    entry.debounceTimer = null
  }

  await entry.watcher.close()
}

export function createProjectGitWatcher(args: {
  projectRepository: Pick<ProjectRepository, "getProjectById">
  watchFactory?: WatchFactory
}): ProjectGitWatcher {
  const watchFactory = args.watchFactory ?? watch
  const entryByProjectId = new Map<string, ProjectGitWatcherEntry>()
  const pendingEntryByProjectId = new Map<string, Promise<ProjectGitWatcherEntry>>()

  function scheduleProjectChange(entry: ProjectGitWatcherEntry) {
    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer)
    }

    entry.debounceTimer = setTimeout(() => {
      entry.debounceTimer = null

      const event: ProjectGitChangeEvent = {
        projectId: entry.projectId,
        changedAt: new Date().toISOString(),
      }

      for (const listener of entry.listeners) {
        listener(event)
      }
    }, WATCHER_DEBOUNCE_MS)
  }

  async function createEntry(projectId: string) {
    const project = await args.projectRepository.getProjectById(projectId)
    if (!project) {
      throw createGitError.projectNotFound(projectId)
    }

    const watcher = watchFactory(
      [
        project.path,
        path.join(project.path, ".git", "HEAD"),
        path.join(project.path, ".git", "index"),
      ],
      {
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 150,
          pollInterval: 25,
        },
        ignored: createIgnoredMatcher(project.path),
      },
    )

    const entry: ProjectGitWatcherEntry = {
      projectId,
      watcher,
      listeners: new Set(),
      debounceTimer: null,
    }

    for (const eventName of WATCHER_EVENT_NAMES) {
      watcher.on(eventName, () => {
        scheduleProjectChange(entry)
      })
    }

    return entry
  }

  async function getOrCreateEntry(projectId: string) {
    const existingEntry = entryByProjectId.get(projectId)
    if (existingEntry) {
      return existingEntry
    }

    const pendingEntry = pendingEntryByProjectId.get(projectId)
    if (pendingEntry) {
      return pendingEntry
    }

    const nextEntryPromise = createEntry(projectId)
      .then((entry) => {
        entryByProjectId.set(projectId, entry)
        pendingEntryByProjectId.delete(projectId)
        return entry
      })
      .catch((error) => {
        pendingEntryByProjectId.delete(projectId)
        throw error
      })

    pendingEntryByProjectId.set(projectId, nextEntryPromise)
    return nextEntryPromise
  }

  async function subscribe(
    projectId: string,
    listener: ProjectGitWatcherListener,
  ) {
    const normalizedProjectId = projectId.trim()
    if (!normalizedProjectId) {
      throw createGitError.invalidProjectId()
    }

    const entry = await getOrCreateEntry(normalizedProjectId)
    entry.listeners.add(listener)

    return async () => {
      const currentEntry = entryByProjectId.get(normalizedProjectId)
      if (!currentEntry) {
        return
      }

      currentEntry.listeners.delete(listener)
      if (currentEntry.listeners.size > 0) {
        return
      }

      entryByProjectId.delete(normalizedProjectId)
      await closeWatcherEntry(currentEntry)
    }
  }

  async function close() {
    pendingEntryByProjectId.clear()

    const entries = [...entryByProjectId.values()]
    entryByProjectId.clear()

    await Promise.all(entries.map((entry) => closeWatcherEntry(entry)))
  }

  return {
    subscribe,
    close,
  }
}
