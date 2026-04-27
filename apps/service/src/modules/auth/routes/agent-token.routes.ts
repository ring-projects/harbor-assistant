import type { FastifyInstance } from "fastify"

import { ERROR_CODES } from "../../../constants/errors"
import { AppError } from "../../../lib/errors/app-error"
import type {
  AuthorizationAction,
  AuthorizationActor,
  AuthorizationOrchestrationQuery,
  AuthorizationProjectQuery,
  AuthorizationService,
  AuthorizationTaskQuery,
  AuthorizationResource,
} from "../../authorization"
import { PrismaAgentTokenStore } from "../infrastructure/prisma-agent-token-store"
import {
  getAuthenticatedActor,
  requireAuthenticatedRequest,
} from "../plugin/auth-session"
import {
  delegateAgentTokenRouteSchema,
  type DelegateAgentTokenBody,
} from "../schemas"

function toRequestedId(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function ensureSupportedAgentScope(scope: AuthorizationAction) {
  if (scope.startsWith("workspace.") || scope === "project.create") {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST_BODY,
      400,
      `scope "${scope}" is not supported for agent tokens`,
    )
  }
}

async function resolveDelegationTarget(args: {
  projectQuery: AuthorizationProjectQuery
  taskQuery: AuthorizationTaskQuery
  orchestrationQuery: AuthorizationOrchestrationQuery
  body: DelegateAgentTokenBody
}) {
  const requestedProjectId = toRequestedId(args.body.projectId)
  const requestedOrchestrationId = toRequestedId(args.body.orchestrationId)
  const requestedTaskId = toRequestedId(args.body.taskId)

  if (!requestedProjectId && !requestedOrchestrationId && !requestedTaskId) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST_BODY,
      400,
      "projectId, orchestrationId, or taskId is required.",
    )
  }

  let projectId = requestedProjectId
  let orchestrationId = requestedOrchestrationId
  let taskId = requestedTaskId

  if (taskId) {
    const task = await args.taskQuery.getTaskAuthorizationContext(taskId)
    if (!task) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, "Task not found.")
    }

    if (projectId && projectId !== task.projectId) {
      throw new AppError(
        ERROR_CODES.INVALID_REQUEST_BODY,
        400,
        "taskId does not belong to the provided projectId.",
      )
    }
    if (orchestrationId && orchestrationId !== task.orchestrationId) {
      throw new AppError(
        ERROR_CODES.INVALID_REQUEST_BODY,
        400,
        "taskId does not belong to the provided orchestrationId.",
      )
    }

    projectId = task.projectId
    orchestrationId = task.orchestrationId
  }

  if (orchestrationId) {
    const orchestration =
      await args.orchestrationQuery.getOrchestrationAuthorizationContext(
        orchestrationId,
      )
    if (!orchestration) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, "Orchestration not found.")
    }

    if (projectId && projectId !== orchestration.projectId) {
      throw new AppError(
        ERROR_CODES.INVALID_REQUEST_BODY,
        400,
        "orchestrationId does not belong to the provided projectId.",
      )
    }

    projectId = orchestration.projectId
  }

  if (!projectId) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST_BODY,
      400,
      "projectId could not be resolved.",
    )
  }

  const project =
    await args.projectQuery.getProjectAuthorizationContext(projectId)
  if (!project) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 404, "Project not found.")
  }

  return {
    projectId,
    orchestrationId,
    taskId,
  }
}

function toDelegationResource(
  action: AuthorizationAction,
  target: {
    projectId: string
    orchestrationId: string | null
    taskId: string | null
  },
): AuthorizationResource {
  ensureSupportedAgentScope(action)

  if (action.startsWith("project.")) {
    return {
      kind: "project",
      projectId: target.projectId,
    }
  }

  if (action === "orchestration.create") {
    return {
      kind: "project",
      projectId: target.projectId,
    }
  }

  if (action.startsWith("orchestration.")) {
    if (!target.orchestrationId) {
      throw new AppError(
        ERROR_CODES.INVALID_REQUEST_BODY,
        400,
        `scope "${action}" requires orchestrationId.`,
      )
    }

    return {
      kind: "orchestration",
      orchestrationId: target.orchestrationId,
    }
  }

  if (action.startsWith("task.")) {
    if (!target.taskId) {
      throw new AppError(
        ERROR_CODES.INVALID_REQUEST_BODY,
        400,
        `scope "${action}" requires taskId.`,
      )
    }

    return {
      kind: "task",
      taskId: target.taskId,
    }
  }

  throw new AppError(
    ERROR_CODES.INVALID_REQUEST_BODY,
    400,
    `scope "${action}" is not supported for agent tokens`,
  )
}

function assertDelegationWithinParentBounds(input: {
  actor: Extract<AuthorizationActor, { kind: "agent" }>
  target: {
    projectId: string
    orchestrationId: string | null
    taskId: string | null
  }
  requestedScopes: AuthorizationAction[]
}) {
  if (
    input.requestedScopes.some((scope) => !input.actor.scopes.includes(scope))
  ) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      403,
      "Delegated scopes must be a subset of the parent token scopes.",
    )
  }

  if (
    input.actor.projectId &&
    input.actor.projectId !== input.target.projectId
  ) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      403,
      "Delegated token cannot expand the project boundary.",
    )
  }

  if (
    input.actor.orchestrationId &&
    input.actor.orchestrationId !== input.target.orchestrationId
  ) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      403,
      "Delegated token cannot expand the orchestration boundary.",
    )
  }

  if (input.actor.taskId && input.actor.taskId !== input.target.taskId) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      403,
      "Delegated token cannot expand the task boundary.",
    )
  }
}

export async function registerAgentTokenRoutes(
  app: FastifyInstance,
  options: {
    authorization: AuthorizationService
    agentTokenStore: PrismaAgentTokenStore
    projectQuery: AuthorizationProjectQuery
    orchestrationQuery: AuthorizationOrchestrationQuery
    taskQuery: AuthorizationTaskQuery
  },
) {
  app.post<{ Body: DelegateAgentTokenBody }>(
    "/auth/agent-tokens/delegate",
    {
      schema: delegateAgentTokenRouteSchema,
    },
    async (request, reply) => {
      const auth = requireAuthenticatedRequest(request)
      const actor = getAuthenticatedActor(request)
      const target = await resolveDelegationTarget({
        projectQuery: options.projectQuery,
        orchestrationQuery: options.orchestrationQuery,
        taskQuery: options.taskQuery,
        body: request.body,
      })

      const scopes = request.body.scopes.map((scope) =>
        scope.trim(),
      ) as AuthorizationAction[]
      if (scopes.length === 0) {
        throw new AppError(
          ERROR_CODES.INVALID_REQUEST_BODY,
          400,
          "scopes are required.",
        )
      }

      if (actor.kind === "user") {
        for (const scope of scopes) {
          await options.authorization.requireAuthorized({
            actor,
            action: scope,
            resource: toDelegationResource(scope, target),
          })
        }
      } else if (actor.kind === "agent") {
        assertDelegationWithinParentBounds({
          actor,
          target,
          requestedScopes: scopes,
        })
      }

      const created = await options.agentTokenStore.createToken({
        name: request.body.name,
        issuedByUserId:
          auth.kind === "agent" ? auth.issuedByUserId : auth.userId,
        parentTokenId: auth.kind === "agent" ? auth.tokenId : null,
        projectId: target.projectId,
        orchestrationId: target.orchestrationId,
        taskId: target.taskId,
        scopes,
        ttlSeconds: request.body.ttlSeconds,
      })

      return reply.status(201).send({
        ok: true,
        agentToken: {
          id: created.record.id,
          token: created.token,
          issuedByUserId: created.record.issuedByUserId,
          projectId: created.record.projectId,
          orchestrationId: created.record.orchestrationId,
          taskId: created.record.taskId,
          scopes: created.record.scopes,
          expiresAt: created.record.expiresAt,
          createdAt: created.record.createdAt,
        },
      })
    },
  )
}
