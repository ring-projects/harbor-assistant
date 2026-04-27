import { describe, expect, it } from "vitest"

import {
  assertOrchestrationIsActive,
  createOrchestration,
  DEFAULT_ORCHESTRATION_TITLE,
  resolveOrchestrationTitle,
} from "./orchestration"

describe("orchestration domain", () => {
  it("defaults new orchestrations to active", () => {
    const orchestration = createOrchestration({
      id: "orch-1",
      projectId: "project-1",
      title: "Runtime cleanup",
    })

    expect(orchestration.status).toBe("active")
    expect(orchestration.archivedAt).toBeNull()
  })

  it("falls back to a default title when none is provided", () => {
    const orchestration = createOrchestration({
      id: "orch-1",
      projectId: "project-1",
    })

    expect(orchestration.title).toBe(DEFAULT_ORCHESTRATION_TITLE)
  })

  it("prefers the explicit title over the fallback title", () => {
    expect(
      resolveOrchestrationTitle({
        title: "  Runtime cleanup  ",
        fallbackTitle: "Investigate runtime drift",
      }),
    ).toBe("Runtime cleanup")
  })

  it("rejects new tasks for archived orchestrations", () => {
    const orchestration = createOrchestration({
      id: "orch-1",
      projectId: "project-1",
      title: "Runtime cleanup",
      status: "archived",
      archivedAt: new Date("2026-04-01T00:00:00.000Z"),
    })

    expect(() => assertOrchestrationIsActive(orchestration)).toThrow(
      "archived orchestrations cannot accept new tasks",
    )
  })
})
