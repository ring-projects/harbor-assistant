import { create } from "zustand"

type AppState = {
  activeProjectId: string | null
  setActiveProjectId: (projectId: string | null) => void
  clearActiveProjectId: () => void
}

export const useAppStore = create<AppState>((set) => ({
  activeProjectId: null,
  setActiveProjectId: (projectId) =>
    set({
      activeProjectId: projectId,
    }),
  clearActiveProjectId: () =>
    set({
      activeProjectId: null,
    }),
}))
