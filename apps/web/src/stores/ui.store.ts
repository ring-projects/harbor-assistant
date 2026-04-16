import { create } from "zustand"

type UiState = {
  settingsOpen: boolean
  settingsProjectId: string | null
  addProjectModalOpen: boolean
  addProjectModalWorkspaceId: string | null
  openSettings: (projectId?: string | null) => void
  closeSettings: () => void
  openAddProjectModal: (workspaceId?: string | null) => void
  closeAddProjectModal: () => void
}

export const useUiStore = create<UiState>((set) => ({
  settingsOpen: false,
  settingsProjectId: null,
  addProjectModalOpen: false,
  addProjectModalWorkspaceId: null,
  openSettings: (projectId) =>
    set({
      settingsOpen: true,
      settingsProjectId: projectId ?? null,
    }),
  closeSettings: () =>
    set({
      settingsOpen: false,
    }),
  openAddProjectModal: (workspaceId) =>
    set({
      addProjectModalOpen: true,
      addProjectModalWorkspaceId: workspaceId ?? null,
    }),
  closeAddProjectModal: () =>
    set({
      addProjectModalOpen: false,
      addProjectModalWorkspaceId: null,
    }),
}))
