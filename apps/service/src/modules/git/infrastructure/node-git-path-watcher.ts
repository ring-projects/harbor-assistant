import { watch, type FSWatcher } from "node:fs"

import type {
  GitPathChangeEvent,
  GitPathWatcher,
} from "../application/git-path-watcher"

type CreateFsWatcher = (
  path: string,
  options: {
    persistent?: boolean
    recursive?: boolean
  },
  listener: (eventType: string, filename: string | Buffer | null) => void,
) => FSWatcher

type WatchEntry = {
  watcher: FSWatcher
  listeners: Set<(event: GitPathChangeEvent) => void>
  timer: NodeJS.Timeout | null
}

export function createNodeGitPathWatcher(args?: {
  createFsWatcher?: CreateFsWatcher
  debounceMs?: number
  now?: () => Date
}): GitPathWatcher {
  const createFsWatcher = args?.createFsWatcher ?? watch
  const debounceMs = args?.debounceMs ?? 75
  const now = args?.now ?? (() => new Date())
  const entries = new Map<string, WatchEntry>()

  function emitChange(path: string) {
    const entry = entries.get(path)
    if (!entry) {
      return
    }

    const event: GitPathChangeEvent = {
      path,
      changedAt: now().toISOString(),
    }

    for (const listener of entry.listeners) {
      listener(event)
    }
  }

  function scheduleChange(path: string) {
    const entry = entries.get(path)
    if (!entry) {
      return
    }

    if (debounceMs <= 0) {
      emitChange(path)
      return
    }

    if (entry.timer) {
      clearTimeout(entry.timer)
    }

    entry.timer = setTimeout(() => {
      const activeEntry = entries.get(path)
      if (!activeEntry) {
        return
      }

      activeEntry.timer = null
      emitChange(path)
    }, debounceMs)
  }

  function closeEntry(path: string, entry: WatchEntry) {
    if (entry.timer) {
      clearTimeout(entry.timer)
      entry.timer = null
    }
    entry.watcher.close()
    entries.delete(path)
  }

  return {
    async subscribe(path, listener) {
      const normalizedPath = path.trim()
      if (!normalizedPath) {
        throw new Error("Git watcher path is required.")
      }

      let entry = entries.get(normalizedPath)
      if (!entry) {
        const watcher = createFsWatcher(
          normalizedPath,
          {
            persistent: false,
            recursive: true,
          },
          () => {
            scheduleChange(normalizedPath)
          },
        )

        entry = {
          watcher,
          listeners: new Set(),
          timer: null,
        }

        watcher.on("error", () => {
          const activeEntry = entries.get(normalizedPath)
          if (!activeEntry) {
            return
          }

          closeEntry(normalizedPath, activeEntry)
        })

        entries.set(normalizedPath, entry)
      }

      entry.listeners.add(listener)

      return () => {
        const activeEntry = entries.get(normalizedPath)
        if (!activeEntry) {
          return
        }

        activeEntry.listeners.delete(listener)
        if (activeEntry.listeners.size === 0) {
          closeEntry(normalizedPath, activeEntry)
        }
      }
    },

    async close() {
      for (const [path, entry] of entries) {
        closeEntry(path, entry)
      }
    },
  }
}
