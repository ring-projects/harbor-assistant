import { describe, expect, it } from "vitest"

import { WORKSPACE_ERROR_CODES, WorkspaceError } from "../errors"
import {
  acceptWorkspaceInvitation,
  createWorkspace,
  createWorkspaceInvitation,
} from "./workspace"

describe("workspace invitation rules", () => {
  it("creates an invitation for a team workspace", () => {
    const workspace = createWorkspace({
      id: "ws-1",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })

    const invitation = createWorkspaceInvitation(workspace, {
      id: "invite-1",
      inviteeGithubLogin: "octocat",
      invitedByUserId: "user-1",
      now: new Date("2026-04-10T00:00:00.000Z"),
    })

    expect(invitation).toEqual({
      id: "invite-1",
      workspaceId: "ws-1",
      inviteeGithubLogin: "octocat",
      role: "member",
      status: "pending",
      invitedByUserId: "user-1",
      acceptedByUserId: null,
      createdAt: new Date("2026-04-10T00:00:00.000Z"),
      updatedAt: new Date("2026-04-10T00:00:00.000Z"),
      acceptedAt: null,
    })
  })

  it("rejects invitations for personal workspaces", () => {
    const workspace = createWorkspace({
      id: "ws-1",
      name: "Qiuhao",
      type: "personal",
      createdByUserId: "user-1",
    })

    expect(() =>
      createWorkspaceInvitation(workspace, {
        id: "invite-1",
        inviteeGithubLogin: "octocat",
        invitedByUserId: "user-1",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: WORKSPACE_ERROR_CODES.INVALID_STATE,
      } satisfies Partial<WorkspaceError>),
    )
  })

  it("marks an invitation as accepted", () => {
    const invitation = createWorkspaceInvitation(
      createWorkspace({
        id: "ws-1",
        name: "Harbor Team",
        type: "team",
        createdByUserId: "user-1",
      }),
      {
        id: "invite-1",
        inviteeGithubLogin: "octocat",
        invitedByUserId: "user-1",
        now: new Date("2026-04-10T00:00:00.000Z"),
      },
    )

    const accepted = acceptWorkspaceInvitation(
      invitation,
      {
        acceptedByUserId: "user-2",
      },
      new Date("2026-04-10T01:00:00.000Z"),
    )

    expect(accepted).toEqual({
      ...invitation,
      status: "accepted",
      acceptedByUserId: "user-2",
      acceptedAt: new Date("2026-04-10T01:00:00.000Z"),
      updatedAt: new Date("2026-04-10T01:00:00.000Z"),
    })
  })
})
