import { afterEach, describe, expect, it } from "vitest"

import { useAppStore } from "./app.store"

afterEach(() => {
  useAppStore.setState({
    activeProjectId: null,
  })
})

describe("useAppStore", () => {
  it("sets the active project id", () => {
    useAppStore.getState().setActiveProjectId("demo-project")
    expect(useAppStore.getState().activeProjectId).toBe("demo-project")
  })

  it("clears the active project id", () => {
    useAppStore.getState().setActiveProjectId("demo-project")
    useAppStore.getState().clearActiveProjectId()
    expect(useAppStore.getState().activeProjectId).toBeNull()
  })
})
