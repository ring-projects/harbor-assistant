import { createStore } from "zustand/vanilla"

import type { ProjectStoreState } from "./types"

export function createProjectStore(projectId: string) {
  return createStore<ProjectStoreState>()((set) => ({
    projectId,
    panelOpen: true,
    setPanelOpen: (open) => set({ panelOpen: open }),
    togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),
  }))
}

export type ProjectStore = ReturnType<typeof createProjectStore>
