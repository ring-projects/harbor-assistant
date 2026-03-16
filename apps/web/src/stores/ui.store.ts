import { create } from "zustand"

type UiState = {
  settingsOpen: boolean
  settingsProjectId: string | null
  openSettings: (projectId?: string | null) => void
  closeSettings: () => void
}

export const useUiStore = create<UiState>((set) => ({
  settingsOpen: false,
  settingsProjectId: null,
  openSettings: (projectId) =>
    set({
      settingsOpen: true,
      settingsProjectId: projectId ?? null,
    }),
  closeSettings: () =>
    set({
      settingsOpen: false,
    }),
}))
