import { describe, expect, it } from "vitest"

import { WORKSPACE_ERROR_CODES, WorkspaceError } from "../errors"
import { createWorkspace } from "./workspace"

describe("createWorkspace", () => {
  it("creates a personal workspace with an owner membership", () => {
    const workspace = createWorkspace({
      id: "ws_1",
      name: "Qiuhao",
      type: "personal",
      createdByUserId: "user-1",
      now: new Date("2026-04-06T00:00:00.000Z"),
    })

    expect(workspace.slug).toBe("qiuhao")
    expect(workspace.type).toBe("personal")
    expect(workspace.memberships).toEqual([
      {
        workspaceId: "ws_1",
        userId: "user-1",
        role: "owner",
        status: "active",
        createdAt: new Date("2026-04-06T00:00:00.000Z"),
        updatedAt: new Date("2026-04-06T00:00:00.000Z"),
      },
    ])
  })

  it("creates a team workspace with an owner membership", () => {
    const workspace = createWorkspace({
      id: "ws_1",
      name: "Harbor Core",
      type: "team",
      createdByUserId: "user-1",
    })

    expect(workspace.type).toBe("team")
    expect(workspace.memberships).toHaveLength(1)
    expect(workspace.memberships[0]).toMatchObject({
      workspaceId: "ws_1",
      userId: "user-1",
      role: "owner",
      status: "active",
    })
  })

  it("rejects empty workspace names", () => {
    expect(() =>
      createWorkspace({
        id: "ws_1",
        name: "   ",
        type: "team",
        createdByUserId: "user-1",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: WORKSPACE_ERROR_CODES.INVALID_INPUT,
      } satisfies Partial<WorkspaceError>),
    )
  })
})
