import { create } from "zustand"

type ProjectsState = {
  activeProjectId: string | null
  setActiveProjectId: (projectId: string | null) => void
}

export const useProjectsStore = create<ProjectsState>((set) => ({
  activeProjectId: null,
  setActiveProjectId: (projectId) => set({ activeProjectId: projectId }),
}))
