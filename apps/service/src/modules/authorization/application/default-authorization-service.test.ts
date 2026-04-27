import { describe, expect, it } from "vitest"

import { createDefaultAuthorizationService } from "./default-authorization-service"
import type {
  AuthorizationOrchestrationContext,
  AuthorizationOrchestrationQuery,
  AuthorizationProjectContext,
  AuthorizationProjectQuery,
  AuthorizationTaskContext,
  AuthorizationTaskQuery,
  AuthorizationWorkspaceAccessContext,
  AuthorizationWorkspaceQuery,
} from "./authorization-queries"

function createWorkspaceQuery(
  contexts: Record<string, AuthorizationWorkspaceAccessContext>,
): AuthorizationWorkspaceQuery {
  return {
    async getWorkspaceAccessContext(workspaceId, _actorUserId) {
      return (
        contexts[workspaceId] ?? {
          workspaceId,
          exists: false,
          membership: null,
        }
      )
    },
  }
}

function createProjectQuery(
  contexts: Record<string, AuthorizationProjectContext>,
): AuthorizationProjectQuery {
  return {
    async getProjectAuthorizationContext(projectId) {
      return contexts[projectId] ?? null
    },
  }
}

function createTaskQuery(
  contexts: Record<string, AuthorizationTaskContext>,
): AuthorizationTaskQuery {
  return {
    async getTaskAuthorizationContext(taskId) {
      return contexts[taskId] ?? null
    },
  }
}

function createOrchestrationQuery(
  contexts: Record<string, AuthorizationOrchestrationContext>,
): AuthorizationOrchestrationQuery {
  return {
    async getOrchestrationAuthorizationContext(orchestrationId) {
      return contexts[orchestrationId] ?? null
    },
  }
}

describe("createDefaultAuthorizationService", () => {
  it("allows workspace owners to manage workspace members", async () => {
    const service = createDefaultAuthorizationService({
      workspaceQuery: createWorkspaceQuery({
        "ws-1": {
          workspaceId: "ws-1",
          exists: true,
          membership: {
            role: "owner",
            status: "active",
          },
        },
      }),
      projectQuery: createProjectQuery({}),
      taskQuery: createTaskQuery({}),
      orchestrationQuery: createOrchestrationQuery({}),
    })

    await expect(
      service.authorize({
        actor: { kind: "user", userId: "user-1" },
        action: "workspace.members.manage",
        resource: { kind: "workspace", workspaceId: "ws-1" },
      }),
    ).resolves.toMatchObject({
      effect: "allow",
    })
  })

  it("rejects workspace member management by non-owner members", async () => {
    const service = createDefaultAuthorizationService({
      workspaceQuery: createWorkspaceQuery({
        "ws-1": {
          workspaceId: "ws-1",
          exists: true,
          membership: {
            role: "member",
            status: "active",
          },
        },
      }),
      projectQuery: createProjectQuery({}),
      taskQuery: createTaskQuery({}),
      orchestrationQuery: createOrchestrationQuery({}),
    })

    await expect(
      service.authorize({
        actor: { kind: "user", userId: "user-2" },
        action: "workspace.members.manage",
        resource: { kind: "workspace", workspaceId: "ws-1" },
      }),
    ).resolves.toMatchObject({
      effect: "deny",
      reason: "permission_denied",
      httpStatus: 403,
    })
  })

  it("rejects project management actions for non-owner workspace members", async () => {
    const service = createDefaultAuthorizationService({
      workspaceQuery: createWorkspaceQuery({
        "ws-1": {
          workspaceId: "ws-1",
          exists: true,
          membership: {
            role: "member",
            status: "active",
          },
        },
      }),
      projectQuery: createProjectQuery({
        "project-1": {
          projectId: "project-1",
          ownerUserId: "user-1",
          workspaceId: "ws-1",
          status: "active",
          sourceType: "git",
          hasWorkspaceRoot: true,
        },
      }),
      taskQuery: createTaskQuery({}),
      orchestrationQuery: createOrchestrationQuery({}),
    })

    await expect(
      service.authorize({
        actor: { kind: "user", userId: "user-2" },
        action: "project.delete",
        resource: { kind: "project", projectId: "project-1" },
      }),
    ).resolves.toMatchObject({
      effect: "deny",
      reason: "permission_denied",
      httpStatus: 403,
    })
  })

  it("allows project read and task-facing actions for workspace members", async () => {
    const service = createDefaultAuthorizationService({
      workspaceQuery: createWorkspaceQuery({
        "ws-1": {
          workspaceId: "ws-1",
          exists: true,
          membership: {
            role: "member",
            status: "active",
          },
        },
      }),
      projectQuery: createProjectQuery({
        "project-1": {
          projectId: "project-1",
          ownerUserId: "user-1",
          workspaceId: "ws-1",
          status: "active",
          sourceType: "git",
          hasWorkspaceRoot: true,
        },
      }),
      taskQuery: createTaskQuery({}),
      orchestrationQuery: createOrchestrationQuery({}),
    })

    await expect(
      service.authorize({
        actor: { kind: "user", userId: "user-2" },
        action: "project.files.read",
        resource: { kind: "project", projectId: "project-1" },
      }),
    ).resolves.toMatchObject({
      effect: "allow",
    })

    await expect(
      service.authorize({
        actor: { kind: "user", userId: "user-2" },
        action: "project.tasks.create",
        resource: { kind: "project", projectId: "project-1" },
      }),
    ).resolves.toMatchObject({
      effect: "allow",
    })
  })

  it("rejects workspace-level management actions for non-owner members", async () => {
    const service = createDefaultAuthorizationService({
      workspaceQuery: createWorkspaceQuery({
        "ws-1": {
          workspaceId: "ws-1",
          exists: true,
          membership: {
            role: "member",
            status: "active",
          },
        },
      }),
      projectQuery: createProjectQuery({}),
      taskQuery: createTaskQuery({}),
      orchestrationQuery: createOrchestrationQuery({}),
    })

    await expect(
      service.authorize({
        actor: { kind: "user", userId: "user-2" },
        action: "project.create",
        resource: { kind: "workspace", workspaceId: "ws-1" },
      }),
    ).resolves.toMatchObject({
      effect: "deny",
      reason: "permission_denied",
      httpStatus: 403,
    })
  })

  it("hides workspace projects from non-members", async () => {
    const service = createDefaultAuthorizationService({
      workspaceQuery: createWorkspaceQuery({
        "ws-1": {
          workspaceId: "ws-1",
          exists: true,
          membership: null,
        },
      }),
      projectQuery: createProjectQuery({
        "project-1": {
          projectId: "project-1",
          ownerUserId: "user-1",
          workspaceId: "ws-1",
          status: "active",
          sourceType: "rootPath",
          hasWorkspaceRoot: true,
        },
      }),
      taskQuery: createTaskQuery({}),
      orchestrationQuery: createOrchestrationQuery({}),
    })

    await expect(
      service.authorize({
        actor: { kind: "user", userId: "user-3" },
        action: "project.view",
        resource: { kind: "project", projectId: "project-1" },
      }),
    ).resolves.toMatchObject({
      effect: "deny",
      reason: "resource_not_visible",
      httpStatus: 404,
    })
  })

  it("keeps legacy owner fallback for unmigrated projects", async () => {
    const service = createDefaultAuthorizationService({
      workspaceQuery: createWorkspaceQuery({}),
      projectQuery: createProjectQuery({
        "project-1": {
          projectId: "project-1",
          ownerUserId: "user-1",
          workspaceId: null,
          status: "active",
          sourceType: "rootPath",
          hasWorkspaceRoot: true,
        },
      }),
      taskQuery: createTaskQuery({}),
      orchestrationQuery: createOrchestrationQuery({}),
    })

    await expect(
      service.authorize({
        actor: { kind: "user", userId: "user-1" },
        action: "project.settings.update",
        resource: { kind: "project", projectId: "project-1" },
      }),
    ).resolves.toMatchObject({
      effect: "allow",
    })

    await expect(
      service.authorize({
        actor: { kind: "user", userId: "user-2" },
        action: "project.view",
        resource: { kind: "project", projectId: "project-1" },
      }),
    ).resolves.toMatchObject({
      effect: "deny",
      reason: "resource_not_visible",
      httpStatus: 404,
    })
  })

  it("inherits task access from the owning project", async () => {
    const service = createDefaultAuthorizationService({
      workspaceQuery: createWorkspaceQuery({
        "ws-1": {
          workspaceId: "ws-1",
          exists: true,
          membership: {
            role: "member",
            status: "active",
          },
        },
      }),
      projectQuery: createProjectQuery({
        "project-1": {
          projectId: "project-1",
          ownerUserId: "user-1",
          workspaceId: "ws-1",
          status: "active",
          sourceType: "git",
          hasWorkspaceRoot: true,
        },
      }),
      taskQuery: createTaskQuery({
        "task-1": {
          taskId: "task-1",
          projectId: "project-1",
          orchestrationId: "orch-1",
        },
      }),
      orchestrationQuery: createOrchestrationQuery({}),
    })

    await expect(
      service.authorize({
        actor: { kind: "user", userId: "user-2" },
        action: "task.events.read",
        resource: { kind: "task", taskId: "task-1" },
      }),
    ).resolves.toMatchObject({
      effect: "allow",
    })
  })

  it("maps deny decisions to AppError in requireAuthorized", async () => {
    const service = createDefaultAuthorizationService({
      workspaceQuery: createWorkspaceQuery({}),
      projectQuery: createProjectQuery({}),
      taskQuery: createTaskQuery({}),
      orchestrationQuery: createOrchestrationQuery({}),
    })

    await expect(
      service.requireAuthorized({
        actor: { kind: "user", userId: "user-1" },
        action: "project.view",
        resource: { kind: "project", projectId: "missing" },
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    })
  })

  it("allows system actors without resource-specific checks", async () => {
    const service = createDefaultAuthorizationService({
      workspaceQuery: createWorkspaceQuery({}),
      projectQuery: createProjectQuery({}),
      taskQuery: createTaskQuery({}),
      orchestrationQuery: createOrchestrationQuery({}),
    })

    await expect(
      service.authorize({
        actor: { kind: "system", systemId: "scheduler" },
        action: "task.delete",
        resource: { kind: "task", taskId: "task-1" },
      }),
    ).resolves.toMatchObject({
      effect: "allow",
    })
  })

  it("allows project-scoped agent tokens within their declared scopes", async () => {
    const service = createDefaultAuthorizationService({
      workspaceQuery: createWorkspaceQuery({}),
      projectQuery: createProjectQuery({
        "project-1": {
          projectId: "project-1",
          ownerUserId: "user-1",
          workspaceId: null,
          status: "active",
          sourceType: "rootPath",
          hasWorkspaceRoot: true,
        },
      }),
      taskQuery: createTaskQuery({}),
      orchestrationQuery: createOrchestrationQuery({}),
    })

    await expect(
      service.authorize({
        actor: {
          kind: "agent",
          tokenId: "agt_1",
          issuedByUserId: "user-1",
          scopes: ["project.git.read", "project.view"],
          projectId: "project-1",
          orchestrationId: null,
          taskId: null,
        },
        action: "project.git.read",
        resource: { kind: "project", projectId: "project-1" },
      }),
    ).resolves.toMatchObject({
      effect: "allow",
    })
  })

  it("rejects agent tokens that try to escape orchestration bounds", async () => {
    const service = createDefaultAuthorizationService({
      workspaceQuery: createWorkspaceQuery({}),
      projectQuery: createProjectQuery({
        "project-1": {
          projectId: "project-1",
          ownerUserId: "user-1",
          workspaceId: null,
          status: "active",
          sourceType: "rootPath",
          hasWorkspaceRoot: true,
        },
      }),
      taskQuery: createTaskQuery({}),
      orchestrationQuery: createOrchestrationQuery({
        "orch-1": {
          orchestrationId: "orch-1",
          projectId: "project-1",
        },
        "orch-2": {
          orchestrationId: "orch-2",
          projectId: "project-1",
        },
      }),
    })

    await expect(
      service.authorize({
        actor: {
          kind: "agent",
          tokenId: "agt_2",
          issuedByUserId: "user-1",
          scopes: ["orchestration.schedule.update"],
          projectId: "project-1",
          orchestrationId: "orch-1",
          taskId: null,
        },
        action: "orchestration.schedule.update",
        resource: { kind: "orchestration", orchestrationId: "orch-2" },
      }),
    ).resolves.toMatchObject({
      effect: "deny",
      reason: "resource_not_visible",
      httpStatus: 404,
    })
  })

  it("rejects agent tokens without the requested scope", async () => {
    const service = createDefaultAuthorizationService({
      workspaceQuery: createWorkspaceQuery({}),
      projectQuery: createProjectQuery({
        "project-1": {
          projectId: "project-1",
          ownerUserId: "user-1",
          workspaceId: null,
          status: "active",
          sourceType: "rootPath",
          hasWorkspaceRoot: true,
        },
      }),
      taskQuery: createTaskQuery({}),
      orchestrationQuery: createOrchestrationQuery({}),
    })

    await expect(
      service.authorize({
        actor: {
          kind: "agent",
          tokenId: "agt_3",
          issuedByUserId: "user-1",
          scopes: ["project.view"],
          projectId: "project-1",
          orchestrationId: null,
          taskId: null,
        },
        action: "project.git.write",
        resource: { kind: "project", projectId: "project-1" },
      }),
    ).resolves.toMatchObject({
      effect: "deny",
      reason: "permission_denied",
      httpStatus: 403,
    })
  })
})
