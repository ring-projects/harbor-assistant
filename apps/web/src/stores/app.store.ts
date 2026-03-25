import { create } from "zustand"
import { persist } from "zustand/middleware"

type AppState = {
  activeProjectId: string | null
  setActiveProjectId: (projectId: string | null) => void
  clearActiveProjectId: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeProjectId: null,
      setActiveProjectId: (projectId) =>
        set({
          activeProjectId: projectId,
        }),
      clearActiveProjectId: () =>
        set({
          activeProjectId: null,
        }),
    }),
    {
      name: "harbor-app",
      partialize: (state) => ({
        activeProjectId: state.activeProjectId,
      }),
    },
  ),
)
