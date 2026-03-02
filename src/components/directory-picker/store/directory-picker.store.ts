import { createStore } from "zustand/vanilla"

import type { DirectoryPickerStoreState } from "../types"

function normalizePath(path: string | null | undefined) {
  const value = path?.trim()
  return value ? value : null
}

export function createDirectoryPickerStore(initialPath?: string) {
  return createStore<DirectoryPickerStoreState>()((set) => ({
    currentPath: normalizePath(initialPath),
    rootPath: null,
    selectedPath: null,
    activeIndex: -1,
    isSubmitting: false,
    actionError: null,
    setCurrentPath: (path) =>
      set({
        currentPath: normalizePath(path),
        selectedPath: null,
        activeIndex: -1,
      }),
    setRootPath: (path) =>
      set((state) => {
        if (state.rootPath) {
          return state
        }

        return { rootPath: path }
      }),
    setSelectedPath: (path) => set({ selectedPath: path }),
    setActiveIndex: (index) => set({ activeIndex: index }),
    setSubmitting: (submitting) => set({ isSubmitting: submitting }),
    setActionError: (message) => set({ actionError: message }),
  }))
}

export type DirectoryPickerStore = ReturnType<typeof createDirectoryPickerStore>
