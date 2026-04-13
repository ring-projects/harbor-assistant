import { describe, expect, it } from "vitest"

import { WORKSPACE_ERROR_CODES, WorkspaceError } from "../errors"
import {
  addWorkspaceMember,
  createWorkspace,
  removeWorkspaceMember,
} from "./workspace"

describe("workspace membership rules", () => {
  it("adds a member to a team workspace", () => {
    const workspace = createWorkspace({
      id: "ws-1",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
      now: new Date("2026-04-10T00:00:00.000Z"),
    })

    const next = addWorkspaceMember(
      workspace,
      {
        userId: "user-2",
      },
      new Date("2026-04-10T01:00:00.000Z"),
    )

    expect(next.memberships).toContainEqual({
      workspaceId: "ws-1",
      userId: "user-2",
      role: "member",
      status: "active",
      createdAt: new Date("2026-04-10T01:00:00.000Z"),
      updatedAt: new Date("2026-04-10T01:00:00.000Z"),
    })
  })

  it("rejects adding members to a personal workspace", () => {
    const workspace = createWorkspace({
      id: "ws-1",
      name: "Qiuhao",
      type: "personal",
      createdByUserId: "user-1",
    })

    expect(() =>
      addWorkspaceMember(workspace, {
        userId: "user-2",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: WORKSPACE_ERROR_CODES.INVALID_STATE,
      } satisfies Partial<WorkspaceError>),
    )
  })

  it("rejects removing an owner membership", () => {
    const workspace = createWorkspace({
      id: "ws-1",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })

    expect(() => removeWorkspaceMember(workspace, "user-1")).toThrowError(
      expect.objectContaining({
        code: WORKSPACE_ERROR_CODES.INVALID_STATE,
      } satisfies Partial<WorkspaceError>),
    )
  })

  it("marks a normal member as removed", () => {
    const workspace = addWorkspaceMember(
      createWorkspace({
        id: "ws-1",
        name: "Harbor Team",
        type: "team",
        createdByUserId: "user-1",
      }),
      {
        userId: "user-2",
      },
      new Date("2026-04-10T01:00:00.000Z"),
    )

    const next = removeWorkspaceMember(
      workspace,
      "user-2",
      new Date("2026-04-10T02:00:00.000Z"),
    )

    expect(
      next.memberships.find((membership) => membership.userId === "user-2"),
    ).toEqual({
      workspaceId: "ws-1",
      userId: "user-2",
      role: "member",
      status: "removed",
      createdAt: new Date("2026-04-10T01:00:00.000Z"),
      updatedAt: new Date("2026-04-10T02:00:00.000Z"),
    })
  })
})
