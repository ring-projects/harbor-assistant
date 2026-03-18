import path from "node:path"
import { watch as watchNative, type FSWatcher as NativeFsWatcher } from "node:fs"

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

type ProjectPathWatcher = {
  close: () => Promise<void>
  onChange: (listener: () => void) => void
}

type ProjectGitWatcherEntry = {
  projectId: string
  watcher: ProjectPathWatcher
  listeners: Set<ProjectGitWatcherListener>
  debounceTimer: ReturnType<typeof setTimeout> | null
}

type WatchFactory = (projectPath: string) => ProjectPathWatcher

const WATCHER_DEBOUNCE_MS = 250

function normalizeFsPath(value: string) {
  return path.resolve(value)
}

function shouldIgnorePath(projectPath: string, watchPath: string) {
  const projectRoot = normalizeFsPath(projectPath)
  const allowedGitPaths = new Set([
    normalizeFsPath(path.join(projectRoot, ".git", "HEAD")),
    normalizeFsPath(path.join(projectRoot, ".git", "index")),
  ])

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

function createNativeRecursiveProjectWatcher(projectPath: string): ProjectPathWatcher {
  const watcher: NativeFsWatcher = watchNative(projectPath, {
    persistent: true,
    recursive: true,
  })

  return {
    close: async () => {
      watcher.close()
    },
    onChange: (listener) => {
      watcher.on("change", (_eventType, filename) => {
        if (
          typeof filename === "string" &&
          shouldIgnorePath(projectPath, path.resolve(projectPath, filename))
        ) {
          return
        }

        listener()
      })
    },
  }
}

function createProjectWatcher(projectPath: string): ProjectPathWatcher {
  return createNativeRecursiveProjectWatcher(projectPath)
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
  const watchFactory = args.watchFactory ?? createProjectWatcher
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

    const watcher = watchFactory(project.path)
    const entry: ProjectGitWatcherEntry = {
      projectId,
      watcher,
      listeners: new Set(),
      debounceTimer: null,
    }

    watcher.onChange(() => {
      scheduleProjectChange(entry)
    })

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
