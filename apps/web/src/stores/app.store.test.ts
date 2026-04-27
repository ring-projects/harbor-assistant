import { afterEach, describe, expect, it } from "vitest"

import { DEFAULT_TASK_CREATION_DEFAULTS, useAppStore } from "./app.store"

afterEach(() => {
  useAppStore.setState({
    activeProjectId: null,
    taskCreationDefaults: DEFAULT_TASK_CREATION_DEFAULTS,
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

  it("updates task creation executor defaults", () => {
    useAppStore.getState().updateTaskCreationDefaults({
      executor: "claude-code",
    })

    expect(useAppStore.getState().taskCreationDefaults).toEqual({
      ...DEFAULT_TASK_CREATION_DEFAULTS,
      executor: "claude-code",
    })
  })

  it("updates task creation runtime defaults without replacing other runtimes", () => {
    useAppStore.getState().updateTaskCreationDefaults({
      runtimes: {
        codex: {
          model: "gpt-5",
          effort: "high",
        },
      },
    })

    expect(useAppStore.getState().taskCreationDefaults).toEqual({
      ...DEFAULT_TASK_CREATION_DEFAULTS,
      runtimes: {
        codex: {
          model: "gpt-5",
          effort: "high",
        },
        "claude-code": {
          model: null,
          effort: null,
        },
      },
    })
  })

  it("merges nested runtime updates", () => {
    useAppStore.getState().updateTaskCreationDefaults({
      runtimes: {
        codex: {
          model: "gpt-5",
        },
      },
    })

    useAppStore.getState().updateTaskCreationDefaults({
      runtimes: {
        codex: {
          effort: "medium",
        },
      },
    })

    expect(useAppStore.getState().taskCreationDefaults.runtimes.codex).toEqual({
      model: "gpt-5",
      effort: "medium",
    })
  })

  it("resets task creation defaults", () => {
    useAppStore.getState().updateTaskCreationDefaults({
      executor: "claude-code",
      runtimes: {
        "claude-code": {
          model: "claude-sonnet-4",
          effort: "low",
        },
      },
    })

    useAppStore.getState().resetTaskCreationDefaults()

    expect(useAppStore.getState().taskCreationDefaults).toEqual(
      DEFAULT_TASK_CREATION_DEFAULTS,
    )
  })
})
