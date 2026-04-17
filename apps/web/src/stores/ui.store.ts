import { create } from "zustand"
import { persist } from "zustand/middleware"

type UiState = {
  settingsOpen: boolean
  settingsProjectId: string | null
  addProjectModalOpen: boolean
  addProjectModalWorkspaceId: string | null
  uiHydrated: boolean
  cookieNoticeDismissed: boolean
  openSettings: (projectId?: string | null) => void
  closeSettings: () => void
  openAddProjectModal: (workspaceId?: string | null) => void
  closeAddProjectModal: () => void
  dismissCookieNotice: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      settingsOpen: false,
      settingsProjectId: null,
      addProjectModalOpen: false,
      addProjectModalWorkspaceId: null,
      uiHydrated: false,
      cookieNoticeDismissed: false,
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
      dismissCookieNotice: () =>
        set({
          cookieNoticeDismissed: true,
        }),
    }),
    {
      name: "harbor-ui",
      partialize: (state) => ({
        cookieNoticeDismissed: state.cookieNoticeDismissed,
      }),
      onRehydrateStorage: () => {
        return () => {
          useUiStore.setState({
            uiHydrated: true,
          })
        }
      },
    },
  ),
)
