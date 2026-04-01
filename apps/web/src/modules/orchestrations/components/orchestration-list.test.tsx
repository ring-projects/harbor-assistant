import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { OrchestrationList } from "./orchestration-list"

vi.mock("@/modules/orchestrations/hooks", () => ({
  useProjectOrchestrationsQuery: vi.fn(() => ({
    isLoading: false,
    isError: false,
    error: null,
    data: [
      {
        id: "orch-1",
        projectId: "project-1",
        title: "Runtime cleanup",
        description: null,
        status: "active",
        archivedAt: null,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        id: "orch-2",
        projectId: "project-1",
        title: "Release review",
        description: null,
        status: "active",
        archivedAt: null,
        createdAt: "2026-04-01T01:00:00.000Z",
        updatedAt: "2026-04-01T01:00:00.000Z",
      },
    ],
  })),
}))

vi.mock("./orchestration-create-dialog", () => ({
  OrchestrationCreateDialog: () => null,
}))

describe("OrchestrationList", () => {
  it("auto-selects the first orchestration and allows switching", () => {
    const onSelectOrchestration = vi.fn()

    render(
      <OrchestrationList
        projectId="project-1"
        selectedOrchestrationId={null}
        onSelectOrchestration={onSelectOrchestration}
      />,
    )

    expect(onSelectOrchestration).toHaveBeenCalledWith("orch-1")

    fireEvent.click(screen.getByRole("button", { name: /release review/i }))

    expect(onSelectOrchestration).toHaveBeenLastCalledWith("orch-2")
  })
})
