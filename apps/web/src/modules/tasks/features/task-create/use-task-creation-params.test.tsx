import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { AgentCapabilityResult } from "@/modules/tasks/contracts"
import { DEFAULT_TASK_CREATION_DEFAULTS, useAppStore } from "@/stores/app.store"

import { useTaskCreationParams } from "./use-task-creation-params"

vi.mock("@/modules/tasks/hooks/use-task-queries", () => ({
  useAgentCapabilitiesQuery: vi.fn(() => ({
    data: capabilities,
  })),
}))

const capabilities: AgentCapabilityResult = {
  checkedAt: "2026-03-31T00:00:00.000Z",
  agents: {
    codex: {
      models: [
        {
          id: "gpt-5.3-codex",
          displayName: "GPT-5.3 Codex",
          isDefault: true,
          efforts: ["low", "medium", "high"],
        },
        {
          id: "gpt-5.4-codex",
          displayName: "GPT-5.4 Codex",
          isDefault: false,
          efforts: ["minimal", "low"],
        },
      ],
      supportsResume: true,
      supportsStreaming: true,
    },
    "claude-code": {
      models: [
        {
          id: "claude-sonnet-4-6",
          displayName: "Claude Sonnet 4.6",
          isDefault: true,
          efforts: ["low", "medium", "high"],
        },
      ],
      supportsResume: true,
      supportsStreaming: true,
    },
  },
}

afterEach(() => {
  act(() => {
    useAppStore.setState({
      activeProjectId: null,
      taskCreationDefaults: DEFAULT_TASK_CREATION_DEFAULTS,
    })
  })
})

describe("useTaskCreationParams", () => {
  it("resolves runtime params from store defaults and capabilities", () => {
    const { result } = renderHook(() => useTaskCreationParams())

    expect(result.current.executor).toBe("codex")
    expect(result.current.model).toBe("gpt-5.3-codex")
    expect(result.current.effort).toBe("medium")
    expect(result.current.executionMode).toBe("full-access")
  })

  it("updates executor-specific defaults through the store", () => {
    const { result } = renderHook(() => useTaskCreationParams())

    act(() => {
      result.current.setModel("gpt-5.4-codex")
    })

    expect(useAppStore.getState().taskCreationDefaults.runtimes.codex).toEqual({
      model: "gpt-5.4-codex",
      effort: null,
    })

    expect(result.current.model).toBe("gpt-5.4-codex")
    expect(result.current.effort).toBe("minimal")
  })

  it("falls back when stored params are no longer valid", () => {
    act(() => {
      useAppStore.setState({
        taskCreationDefaults: {
          executor: "codex",
          runtimes: {
            codex: {
              model: "missing-model",
              effort: "xhigh",
            },
            "claude-code": {
              model: null,
              effort: null,
            },
          },
        },
      })
    })

    const { result } = renderHook(() => useTaskCreationParams())

    expect(result.current.model).toBe("gpt-5.3-codex")
    expect(result.current.effort).toBe("medium")
    expect(result.current.executionMode).toBe("full-access")
  })
})
