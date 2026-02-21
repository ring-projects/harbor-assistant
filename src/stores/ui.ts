"use client"

import { create } from "zustand"

type UiStore = {
  fileExplorerSheetOpen: boolean
  setFileExplorerSheetOpen: (open: boolean) => void
  openFileExplorerSheet: () => void
  closeFileExplorerSheet: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  fileExplorerSheetOpen: false,
  setFileExplorerSheetOpen: (open) => {
    set({ fileExplorerSheetOpen: open })
  },
  openFileExplorerSheet: () => {
    set({ fileExplorerSheetOpen: true })
  },
  closeFileExplorerSheet: () => {
    set({ fileExplorerSheetOpen: false })
  },
}))
