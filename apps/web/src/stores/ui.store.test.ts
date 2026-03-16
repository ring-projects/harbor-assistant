import { afterEach, describe, expect, it } from "vitest"

import { useUiStore } from "./ui.store"

afterEach(() => {
  useUiStore.setState({
    settingsOpen: false,
    settingsScope: "general",
    settingsProjectId: null,
  })
})

describe("useUiStore", () => {
  it("opens settings with the provided scope and project", () => {
    useUiStore.getState().openSettings({
      scope: "project",
      projectId: "demo-project",
    })

    expect(useUiStore.getState().settingsOpen).toBe(true)
    expect(useUiStore.getState().settingsScope).toBe("project")
    expect(useUiStore.getState().settingsProjectId).toBe("demo-project")
  })

  it("updates the active settings scope", () => {
    useUiStore.getState().setSettingsScope("project")
    expect(useUiStore.getState().settingsScope).toBe("project")
  })

  it("closes settings without clearing the current context", () => {
    useUiStore.getState().openSettings({
      scope: "project",
      projectId: "demo-project",
    })

    useUiStore.getState().closeSettings()

    expect(useUiStore.getState().settingsOpen).toBe(false)
    expect(useUiStore.getState().settingsScope).toBe("project")
    expect(useUiStore.getState().settingsProjectId).toBe("demo-project")
  })
})
