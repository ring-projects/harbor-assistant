import { create } from "zustand"

type UiState = {
  settingsOpen: boolean
  settingsProjectId: string | null
  addProjectModalOpen: boolean
  openSettings: (projectId?: string | null) => void
  closeSettings: () => void
  openAddProjectModal: () => void
  closeAddProjectModal: () => void
}

export const useUiStore = create<UiState>((set) => ({
  settingsOpen: false,
  settingsProjectId: null,
  addProjectModalOpen: false,
  openSettings: (projectId) =>
    set({
      settingsOpen: true,
      settingsProjectId: projectId ?? null,
    }),
  closeSettings: () =>
    set({
      settingsOpen: false,
    }),
  openAddProjectModal: () =>
    set({
      addProjectModalOpen: true,
    }),
  closeAddProjectModal: () =>
    set({
      addProjectModalOpen: false,
    }),
}))
