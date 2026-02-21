"use client"

import { create } from "zustand"

import type { Workspace } from "@/services/workspace/types"

const STORAGE_ACTIVE_WORKSPACE_ID = "otter_active_workspace_id"

type WorkspaceStore = {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  isLoading: boolean
  initialized: boolean
  error: string | null
  setActiveWorkspace: (id: string | null) => void
  hydrateWorkspaces: (workspaces: Workspace[]) => void
  loadWorkspaces: () => Promise<void>
  ensureWorkspacesLoaded: () => Promise<void>
}

function getStoredActiveWorkspaceId() {
  if (typeof window === "undefined") {
    return null
  }

  return window.localStorage.getItem(STORAGE_ACTIVE_WORKSPACE_ID)
}

function persistActiveWorkspaceId(id: string | null) {
  if (typeof window === "undefined") {
    return
  }

  if (id) {
    window.localStorage.setItem(STORAGE_ACTIVE_WORKSPACE_ID, id)
    return
  }

  window.localStorage.removeItem(STORAGE_ACTIVE_WORKSPACE_ID)
}

function resolveActiveWorkspaceId(args: {
  workspaces: Workspace[]
  currentActiveWorkspaceId: string | null
}) {
  const { workspaces, currentActiveWorkspaceId } = args

  if (workspaces.length === 0) {
    return null
  }

  if (
    currentActiveWorkspaceId &&
    workspaces.some((workspace) => workspace.id === currentActiveWorkspaceId)
  ) {
    return currentActiveWorkspaceId
  }

  const storedActiveWorkspaceId = getStoredActiveWorkspaceId()
  if (
    storedActiveWorkspaceId &&
    workspaces.some((workspace) => workspace.id === storedActiveWorkspaceId)
  ) {
    return storedActiveWorkspaceId
  }

  return workspaces[0]?.id ?? null
}

function parseWorkspaceListResponse(payload: unknown): Workspace[] {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "ok" in payload &&
    payload.ok &&
    "data" in payload &&
    Array.isArray(payload.data)
  ) {
    return payload.data as Workspace[]
  }

  return []
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  isLoading: false,
  initialized: false,
  error: null,
  setActiveWorkspace: (id) => {
    set((state) => {
      const nextActiveWorkspaceId =
        id && state.workspaces.some((workspace) => workspace.id === id)
          ? id
          : state.workspaces[0]?.id ?? null

      persistActiveWorkspaceId(nextActiveWorkspaceId)

      return {
        activeWorkspaceId: nextActiveWorkspaceId,
      }
    })
  },
  hydrateWorkspaces: (workspaces) => {
    set((state) => {
      const activeWorkspaceId = resolveActiveWorkspaceId({
        workspaces,
        currentActiveWorkspaceId: state.activeWorkspaceId,
      })

      persistActiveWorkspaceId(activeWorkspaceId)

      return {
        workspaces,
        activeWorkspaceId,
        initialized: true,
        error: null,
      }
    })
  },
  loadWorkspaces: async () => {
    set({
      isLoading: true,
      error: null,
    })

    try {
      const response = await fetch("/api/workspaces", {
        method: "GET",
        cache: "no-store",
      })
      const payload: unknown = await response.json()
      const workspaces = parseWorkspaceListResponse(payload)

      set((state) => {
        const activeWorkspaceId = resolveActiveWorkspaceId({
          workspaces,
          currentActiveWorkspaceId: state.activeWorkspaceId,
        })

        persistActiveWorkspaceId(activeWorkspaceId)

        return {
          workspaces,
          activeWorkspaceId,
          isLoading: false,
          initialized: true,
          error: null,
        }
      })
    } catch {
      set({
        isLoading: false,
        initialized: true,
        error: "Failed to load workspaces.",
      })
    }
  },
  ensureWorkspacesLoaded: async () => {
    if (get().initialized || get().isLoading) {
      return
    }

    await get().loadWorkspaces()
  },
}))
