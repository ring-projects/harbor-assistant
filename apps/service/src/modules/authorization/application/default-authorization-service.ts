import { ERROR_CODES } from "../../../constants/errors"
import { AppError } from "../../../lib/errors/app-error"
import type { AuthorizationAction } from "./actions"
import type {
  AuthorizationOrchestrationQuery,
  AuthorizationProjectQuery,
  AuthorizationTaskQuery,
  AuthorizationWorkspaceQuery,
} from "./authorization-queries"
import type { AuthorizationPolicyProvider } from "./policy-provider"
import { createStaticAuthorizationPolicyProvider } from "./static-authorization-policy-provider"
import type {
  ProjectRoleKey,
  WorkspaceRoleKey,
} from "./policy-types"
import type {
  AuthorizationActor,
  AuthorizationDecision,
  AuthorizationDecisionReason,
  AuthorizationInput,
  AuthorizationResource,
  AuthorizationService,
} from "./authorization-service"

function createAllowDecision(input: AuthorizationInput): AuthorizationDecision {
  return {
    effect: "allow",
    actor: input.actor,
    action: input.action,
    resource: input.resource,
  }
}

function createDenyDecision(
  input: AuthorizationInput,
  reason: AuthorizationDecisionReason,
  httpStatus: 401 | 403 | 404,
): AuthorizationDecision {
  return {
    effect: "deny",
    actor: input.actor,
    action: input.action,
    resource: input.resource,
    reason,
    httpStatus,
  }
}

function isActiveMembership(
  membership: { status: "active" | "removed" } | null,
): membership is { status: "active"; role: "owner" | "member" } {
  return membership?.status === "active"
}

function validateActor(input: AuthorizationInput): AuthorizationDecision | null {
  if (input.actor.kind === "system") {
    return createAllowDecision(input)
  }

  if (!input.actor.userId.trim()) {
    return createDenyDecision(input, "actor_invalid", 401)
  }

  return null
}

function toAppError(decision: Extract<AuthorizationDecision, { effect: "deny" }>) {
  switch (decision.httpStatus) {
    case 401:
      return new AppError(
        ERROR_CODES.AUTH_REQUIRED,
        401,
        "Authentication required.",
      )
    case 403:
      return new AppError(
        ERROR_CODES.PERMISSION_DENIED,
        403,
        "Permission denied.",
      )
    case 404:
      return new AppError(ERROR_CODES.NOT_FOUND, 404, "Resource not found.")
  }
}

function isWorkspaceAction(action: AuthorizationAction) {
  return action.startsWith("workspace.") || action === "project.create"
}

function isProjectAction(action: AuthorizationAction) {
  return action.startsWith("project.")
}

function toWorkspaceRoleKey(role: "owner" | "member"): WorkspaceRoleKey {
  return role === "owner" ? "workspace_owner" : "workspace_member"
}

function toProjectRoleKey(input: {
  workspaceRole?: "owner" | "member"
  legacyOwner?: boolean
}): ProjectRoleKey | null {
  if (input.workspaceRole) {
    return input.workspaceRole === "owner"
      ? "workspace_owner"
      : "workspace_member"
  }

  if (input.legacyOwner) {
    return "legacy_project_owner"
  }

  return null
}

async function authorizeWorkspaceResource(
  deps: {
    workspaceQuery: AuthorizationWorkspaceQuery
    policyProvider: AuthorizationPolicyProvider
  },
  input: AuthorizationInput & {
    actor: Extract<AuthorizationActor, { kind: "user" }>
    resource: Extract<AuthorizationResource, { kind: "workspace" }>
  },
): Promise<AuthorizationDecision> {
  if (!isWorkspaceAction(input.action)) {
    return createDenyDecision(input, "permission_denied", 403)
  }

  const context = await deps.workspaceQuery.getWorkspaceAccessContext(
    input.resource.workspaceId,
    input.actor.userId,
  )

  if (!context.exists) {
    return createDenyDecision(input, "resource_not_found", 404)
  }

  if (!isActiveMembership(context.membership)) {
    return createDenyDecision(input, "resource_not_visible", 404)
  }

  const effect = deps.policyProvider.getWorkspaceRoleEffect(
    toWorkspaceRoleKey(context.membership.role),
    input.action,
  )

  return effect === "allow"
    ? createAllowDecision(input)
    : createDenyDecision(input, "permission_denied", 403)
}

async function authorizeProjectResource(
  deps: {
    workspaceQuery: AuthorizationWorkspaceQuery
    projectQuery: AuthorizationProjectQuery
    policyProvider: AuthorizationPolicyProvider
  },
  input: AuthorizationInput & {
    actor: Extract<AuthorizationActor, { kind: "user" }>
    resource: Extract<AuthorizationResource, { kind: "project" }>
  },
): Promise<AuthorizationDecision> {
  if (!isProjectAction(input.action)) {
    return createDenyDecision(input, "permission_denied", 403)
  }

  const project = await deps.projectQuery.getProjectAuthorizationContext(
    input.resource.projectId,
  )
  if (!project) {
    return createDenyDecision(input, "resource_not_found", 404)
  }

  if (project.workspaceId) {
    const context = await deps.workspaceQuery.getWorkspaceAccessContext(
      project.workspaceId,
      input.actor.userId,
    )

    if (!context.exists || !isActiveMembership(context.membership)) {
      return createDenyDecision(input, "resource_not_visible", 404)
    }

    const effect = deps.policyProvider.getProjectRoleEffect(
      toProjectRoleKey({
        workspaceRole: context.membership.role,
      })!,
      input.action,
    )

    return effect === "allow"
      ? createAllowDecision(input)
      : createDenyDecision(input, "permission_denied", 403)
  }

  const projectRoleKey = toProjectRoleKey({
    legacyOwner:
      project.ownerUserId === null || project.ownerUserId === input.actor.userId,
  })
  if (projectRoleKey) {
    const effect = deps.policyProvider.getProjectRoleEffect(
      projectRoleKey,
      input.action,
    )

    if (effect === "allow") {
      return createAllowDecision(input)
    }
  }

  return createDenyDecision(input, "resource_not_visible", 404)
}

async function authorizeTaskResource(
  deps: {
    workspaceQuery: AuthorizationWorkspaceQuery
    projectQuery: AuthorizationProjectQuery
    taskQuery: AuthorizationTaskQuery
    policyProvider: AuthorizationPolicyProvider
  },
  input: AuthorizationInput & {
    actor: Extract<AuthorizationActor, { kind: "user" }>
    resource: Extract<AuthorizationResource, { kind: "task" }>
  },
): Promise<AuthorizationDecision> {
  const projectAction = deps.policyProvider.getDerivedProjectAction(input.action)
  if (!projectAction) {
    return createDenyDecision(input, "permission_denied", 403)
  }

  const task = await deps.taskQuery.getTaskAuthorizationContext(input.resource.taskId)
  if (!task) {
    return createDenyDecision(input, "resource_not_found", 404)
  }

  const projectDecision = await authorizeProjectResource(
    {
      workspaceQuery: deps.workspaceQuery,
      projectQuery: deps.projectQuery,
      policyProvider: deps.policyProvider,
    },
    {
      actor: input.actor,
      action: projectAction,
      resource: {
        kind: "project",
        projectId: task.projectId,
      },
    },
  )

  return projectDecision.effect === "allow"
    ? createAllowDecision(input)
    : createDenyDecision(input, projectDecision.reason, projectDecision.httpStatus)
}

async function authorizeOrchestrationResource(
  deps: {
    workspaceQuery: AuthorizationWorkspaceQuery
    projectQuery: AuthorizationProjectQuery
    orchestrationQuery: AuthorizationOrchestrationQuery
    policyProvider: AuthorizationPolicyProvider
  },
  input: AuthorizationInput & {
    actor: Extract<AuthorizationActor, { kind: "user" }>
    resource: Extract<AuthorizationResource, { kind: "orchestration" }>
  },
): Promise<AuthorizationDecision> {
  const projectAction = deps.policyProvider.getDerivedProjectAction(input.action)
  if (!projectAction) {
    return createDenyDecision(input, "permission_denied", 403)
  }

  const orchestration =
    await deps.orchestrationQuery.getOrchestrationAuthorizationContext(
      input.resource.orchestrationId,
    )
  if (!orchestration) {
    return createDenyDecision(input, "resource_not_found", 404)
  }

  const projectDecision = await authorizeProjectResource(
    {
      workspaceQuery: deps.workspaceQuery,
      projectQuery: deps.projectQuery,
      policyProvider: deps.policyProvider,
    },
    {
      actor: input.actor,
      action: projectAction,
      resource: {
        kind: "project",
        projectId: orchestration.projectId,
      },
    },
  )

  return projectDecision.effect === "allow"
    ? createAllowDecision(input)
    : createDenyDecision(input, projectDecision.reason, projectDecision.httpStatus)
}

export function createDefaultAuthorizationService(deps: {
  workspaceQuery: AuthorizationWorkspaceQuery
  projectQuery: AuthorizationProjectQuery
  taskQuery: AuthorizationTaskQuery
  orchestrationQuery: AuthorizationOrchestrationQuery
  policyProvider?: AuthorizationPolicyProvider
}): AuthorizationService {
  const policyProvider =
    deps.policyProvider ?? createStaticAuthorizationPolicyProvider()

  return {
    async authorize(input) {
      const actorDecision = validateActor(input)
      if (actorDecision) {
        return actorDecision
      }

      const userInput = input as AuthorizationInput & {
        actor: Extract<AuthorizationActor, { kind: "user" }>
      }

      switch (userInput.resource.kind) {
        case "workspace":
          return authorizeWorkspaceResource(
            {
              workspaceQuery: deps.workspaceQuery,
              policyProvider,
            },
            userInput as typeof userInput & {
              resource: Extract<AuthorizationResource, { kind: "workspace" }>
            },
          )
        case "project":
          return authorizeProjectResource(
            {
              workspaceQuery: deps.workspaceQuery,
              projectQuery: deps.projectQuery,
              policyProvider,
            },
            userInput as typeof userInput & {
              resource: Extract<AuthorizationResource, { kind: "project" }>
            },
          )
        case "task":
          return authorizeTaskResource(
            {
              workspaceQuery: deps.workspaceQuery,
              projectQuery: deps.projectQuery,
              taskQuery: deps.taskQuery,
              policyProvider,
            },
            userInput as typeof userInput & {
              resource: Extract<AuthorizationResource, { kind: "task" }>
            },
          )
        case "orchestration":
          return authorizeOrchestrationResource(
            {
              workspaceQuery: deps.workspaceQuery,
              projectQuery: deps.projectQuery,
              orchestrationQuery: deps.orchestrationQuery,
              policyProvider,
            },
            userInput as typeof userInput & {
              resource: Extract<AuthorizationResource, { kind: "orchestration" }>
            },
          )
      }
    },
    async requireAuthorized(input) {
      const decision = await this.authorize(input)
      if (decision.effect === "deny") {
        throw toAppError(decision)
      }
    },
  }
}
