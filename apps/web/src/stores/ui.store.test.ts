import { afterEach, describe, expect, it } from "vitest"

import { useUiStore } from "./ui.store"

afterEach(() => {
  useUiStore.setState({
    settingsOpen: false,
    settingsProjectId: null,
    addProjectModalOpen: false,
  })
})

describe("useUiStore", () => {
  it("opens project settings when a project id is provided", () => {
    useUiStore.getState().openSettings("demo-project")

    expect(useUiStore.getState().settingsOpen).toBe(true)
    expect(useUiStore.getState().settingsProjectId).toBe("demo-project")
  })

  it("opens general settings when no project id is provided", () => {
    useUiStore.getState().openSettings()

    expect(useUiStore.getState().settingsOpen).toBe(true)
    expect(useUiStore.getState().settingsProjectId).toBeNull()
  })

  it("closes settings without clearing the current context", () => {
    useUiStore.getState().openSettings("demo-project")

    useUiStore.getState().closeSettings()

    expect(useUiStore.getState().settingsOpen).toBe(false)
    expect(useUiStore.getState().settingsProjectId).toBe("demo-project")
  })

  it("opens and closes the add project modal", () => {
    useUiStore.getState().openAddProjectModal()
    expect(useUiStore.getState().addProjectModalOpen).toBe(true)

    useUiStore.getState().closeAddProjectModal()
    expect(useUiStore.getState().addProjectModalOpen).toBe(false)
  })
})
