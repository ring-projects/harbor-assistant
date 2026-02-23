"use client"

import { create } from "zustand"

import {
  computeExpandedPaths,
  toTreeMaps,
} from "@/components/file-explorer/tree-utils"
import type {
  FileExplorerState,
  FileExplorerValues,
} from "@/services/file-browser/file-explorer-state"
import type {
  BrowseDirectoryMeta,
  BrowseDirectoryResult,
  FileTreeNode,
} from "@/services/file-browser/types"

export type ExpandedPaths = Record<string, true>
export type NodesByPath = Record<string, FileTreeNode>
export type ChildrenByPath = Record<string, string[]>

type FileExplorerTreeStore = {
  values: FileExplorerValues
  meta: BrowseDirectoryMeta | null
  error: string | null
  rootPath: string | null
  nodesByPath: NodesByPath
  childrenByPath: ChildrenByPath
  expandedPaths: ExpandedPaths
  hydrateFromActionState: (state: FileExplorerState) => void
  mergeSubtree: (result: BrowseDirectoryResult) => void
  updateValues: (patch: Partial<FileExplorerValues>) => void
  setError: (error: string | null) => void
  toggleFolder: (path: string) => void
  setFolderExpanded: (path: string, expanded: boolean) => void
  collapseAllChildren: () => void
}

const DEFAULT_VALUES: FileExplorerValues = {
  includeHidden: false,
}

export const useFileExplorerTreeStore = create<FileExplorerTreeStore>(
  (set) => ({
    values: DEFAULT_VALUES,
    meta: null,
    error: null,
    rootPath: null,
    nodesByPath: {},
    childrenByPath: {},
    expandedPaths: {},
    hydrateFromActionState: (actionState) => {
      set((state) => {
        if (!actionState.result) {
          return {
            values: actionState.values,
            meta: state.meta,
            error: actionState.error,
          }
        }

        const treeMaps = toTreeMaps(actionState.result)
        const expandedPaths = computeExpandedPaths({
          previousRootPath: state.rootPath,
          previousExpandedPaths: state.expandedPaths,
          nextRootPath: treeMaps.rootPath,
          nextNodesByPath: treeMaps.nodesByPath,
        })

        return {
          values: actionState.values,
          meta: actionState.result.meta,
          error: actionState.error,
          rootPath: treeMaps.rootPath,
          nodesByPath: treeMaps.nodesByPath,
          childrenByPath: treeMaps.childrenByPath,
          expandedPaths,
        }
      })
    },
    mergeSubtree: (result) => {
      set((state) => {
        const subtreeMaps = toTreeMaps(result)
        return {
          nodesByPath: {
            ...state.nodesByPath,
            ...subtreeMaps.nodesByPath,
          },
          childrenByPath: {
            ...state.childrenByPath,
            ...subtreeMaps.childrenByPath,
          },
        }
      })
    },
    updateValues: (patch) => {
      set((state) => ({
        values: {
          ...state.values,
          ...patch,
        },
      }))
    },
    setError: (error) => {
      set({ error })
    },
    toggleFolder: (path) => {
      set((state) => {
        if (state.nodesByPath[path]?.type !== "directory") {
          return state
        }

        const isExpanded = Boolean(state.expandedPaths[path])
        const nextExpandedPaths = { ...state.expandedPaths }

        if (isExpanded) {
          delete nextExpandedPaths[path]
        } else {
          nextExpandedPaths[path] = true
        }

        if (state.rootPath) {
          nextExpandedPaths[state.rootPath] = true
        }

        return {
          expandedPaths: nextExpandedPaths,
        }
      })
    },
    setFolderExpanded: (path, expanded) => {
      set((state) => {
        if (state.nodesByPath[path]?.type !== "directory") {
          return state
        }

        const nextExpandedPaths = { ...state.expandedPaths }
        if (expanded) {
          nextExpandedPaths[path] = true
        } else {
          delete nextExpandedPaths[path]
        }

        if (state.rootPath) {
          nextExpandedPaths[state.rootPath] = true
        }

        return {
          expandedPaths: nextExpandedPaths,
        }
      })
    },
    collapseAllChildren: () => {
      set((state) => {
        if (!state.rootPath) {
          return state
        }

        return {
          expandedPaths: {
            [state.rootPath]: true,
          },
        }
      })
    },
  }),
)
