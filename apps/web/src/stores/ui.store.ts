import { create } from "zustand"

export type SettingsScope = "general" | "project"

type UiState = {
  settingsOpen: boolean
  settingsScope: SettingsScope
  settingsProjectId: string | null
  openSettings: (options?: {
    scope?: SettingsScope
    projectId?: string | null
  }) => void
  closeSettings: () => void
  setSettingsScope: (scope: SettingsScope) => void
}

export const useUiStore = create<UiState>((set) => ({
  settingsOpen: false,
  settingsScope: "general",
  settingsProjectId: null,
  openSettings: (options) =>
    set({
      settingsOpen: true,
      settingsScope: options?.scope ?? "general",
      settingsProjectId: options?.projectId ?? null,
    }),
  closeSettings: () =>
    set({
      settingsOpen: false,
    }),
  setSettingsScope: (scope) =>
    set({
      settingsScope: scope,
    }),
}))
