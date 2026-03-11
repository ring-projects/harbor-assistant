import { afterEach, describe, expect, it } from "vitest"

import { useUiStore } from "./ui.store"

afterEach(() => {
  useUiStore.setState({ sidebarOpen: true })
})

describe("useUiStore", () => {
  it("toggles the sidebar state", () => {
    useUiStore.getState().toggleSidebar()
    expect(useUiStore.getState().sidebarOpen).toBe(false)

    useUiStore.getState().toggleSidebar()
    expect(useUiStore.getState().sidebarOpen).toBe(true)
  })

  it("sets the sidebar state explicitly", () => {
    useUiStore.getState().setSidebarOpen(false)
    expect(useUiStore.getState().sidebarOpen).toBe(false)
  })
})
