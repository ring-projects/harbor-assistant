import { z } from "zod"

import { ERROR_CODES } from "@/constants"
import { executorApiFetch } from "@/lib/executor-service-url"
import {
  asRecord,
  parseJsonResponse,
  toIsoDateString,
  toOptionalIsoDateString,
  toStringOrNull,
} from "@/lib/protocol"
import type {
  Workspace,
  WorkspaceInvitation,
  WorkspaceMembership,
} from "@/modules/workspaces/types"

const workspaceApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
})

type WorkspaceApiError = z.infer<typeof workspaceApiErrorSchema>

type WorkspaceEnvelopePayload = {
  ok?: boolean
  error?: WorkspaceApiError
} & Record<string, unknown>

export class WorkspaceApiClientError extends Error {
  code: string
  status: number

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message)
    this.name = "WorkspaceApiClientError"
    this.code = options?.code ?? ERROR_CODES.INTERNAL_ERROR
    this.status = options?.status ?? 500
  }
}

export type CreateWorkspaceInput = {
  name: string
}

async function parseJson(
  response: Response,
): Promise<WorkspaceEnvelopePayload | null> {
  return parseJsonResponse<WorkspaceEnvelopePayload>(response)
}

function throwIfFailed(
  response: Response,
  payload: WorkspaceEnvelopePayload | null,
  fallbackMessage: string,
) {
  const parsedError = workspaceApiErrorSchema.safeParse(payload?.error)

  if (response.ok && payload?.ok !== false) {
    return
  }

  throw new WorkspaceApiClientError(
    parsedError.success ? parsedError.data.message : fallbackMessage,
    {
      status: response.status,
      code: parsedError.success
        ? parsedError.data.code
        : ERROR_CODES.INTERNAL_ERROR,
    },
  )
}

function extractMembership(candidate: unknown): WorkspaceMembership | null {
  const source = asRecord(candidate)
  if (!source) {
    return null
  }

  const workspaceId = toStringOrNull(source.workspaceId)
  const userId = toStringOrNull(source.userId)
  const role = toStringOrNull(source.role)
  const status = toStringOrNull(source.status)

  if (
    !workspaceId ||
    !userId ||
    (role !== "owner" && role !== "member") ||
    (status !== "active" && status !== "removed")
  ) {
    return null
  }

  return {
    workspaceId,
    userId,
    role,
    status,
    createdAt: toIsoDateString(source.createdAt),
    updatedAt: toIsoDateString(source.updatedAt),
  }
}

function extractWorkspace(candidate: unknown): Workspace | null {
  const source = asRecord(candidate)
  if (!source || !Array.isArray(source.memberships)) {
    return null
  }

  const id = toStringOrNull(source.id)
  const slug = toStringOrNull(source.slug)
  const name = toStringOrNull(source.name)
  const type = toStringOrNull(source.type)
  const status = toStringOrNull(source.status)
  const createdByUserId = toStringOrNull(source.createdByUserId)

  if (
    !id ||
    !slug ||
    !name ||
    !createdByUserId ||
    (type !== "personal" && type !== "team") ||
    (status !== "active" && status !== "archived")
  ) {
    return null
  }

  return {
    id,
    slug,
    name,
    type,
    status,
    createdByUserId,
    createdAt: toIsoDateString(source.createdAt),
    updatedAt: toIsoDateString(source.updatedAt),
    archivedAt: toOptionalIsoDateString(source.archivedAt, null),
    memberships: source.memberships
      .map((membership) => extractMembership(membership))
      .filter((membership): membership is WorkspaceMembership => membership !== null),
  }
}

function extractWorkspaceList(payload: unknown): Workspace[] | null {
  const source = asRecord(payload)
  if (!source || !Array.isArray(source.workspaces)) {
    return null
  }

  return source.workspaces
    .map((workspace) => extractWorkspace(workspace))
    .filter((workspace): workspace is Workspace => workspace !== null)
}

function extractWorkspacePayload(payload: unknown): Workspace | null {
  const source = asRecord(payload)
  if (!source) {
    return null
  }

  return extractWorkspace(source.workspace)
}

function extractInvitation(candidate: unknown): WorkspaceInvitation | null {
  const source = asRecord(candidate)
  if (!source) {
    return null
  }

  const id = toStringOrNull(source.id)
  const workspaceId = toStringOrNull(source.workspaceId)
  const inviteeGithubLogin = toStringOrNull(source.inviteeGithubLogin)
  const role = toStringOrNull(source.role)
  const status = toStringOrNull(source.status)
  const invitedByUserId = toStringOrNull(source.invitedByUserId)

  if (
    !id ||
    !workspaceId ||
    !inviteeGithubLogin ||
    !invitedByUserId ||
    role !== "member" ||
    (status !== "pending" && status !== "accepted" && status !== "revoked")
  ) {
    return null
  }

  return {
    id,
    workspaceId,
    inviteeGithubLogin,
    role,
    status,
    invitedByUserId,
    acceptedByUserId: toStringOrNull(source.acceptedByUserId),
    createdAt: toIsoDateString(source.createdAt),
    updatedAt: toIsoDateString(source.updatedAt),
    acceptedAt: toOptionalIsoDateString(source.acceptedAt, null),
  }
}

function extractInvitationList(payload: unknown): WorkspaceInvitation[] | null {
  const source = asRecord(payload)
  if (!source || !Array.isArray(source.invitations)) {
    return null
  }

  return source.invitations
    .map((invitation) => extractInvitation(invitation))
    .filter((invitation): invitation is WorkspaceInvitation => invitation !== null)
}

export async function readWorkspaces(): Promise<Workspace[]> {
  const response = await executorApiFetch("/v1/workspaces", {
    method: "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  })

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load workspaces.")

  const workspaces = extractWorkspaceList(payload)
  if (!workspaces) {
    throw new WorkspaceApiClientError("Workspace list payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return workspaces
}

export async function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<Workspace> {
  const response = await executorApiFetch("/v1/workspaces", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      name: input.name,
    }),
  })

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to create workspace.")

  const workspace = extractWorkspacePayload(payload)
  if (!workspace) {
    throw new WorkspaceApiClientError("Create workspace payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return workspace
}

export async function readWorkspaceInvitations(
  workspaceId: string,
): Promise<WorkspaceInvitation[]> {
  const response = await executorApiFetch(
    `/v1/workspaces/${encodeURIComponent(workspaceId)}/invitations`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load workspace invitations.")

  const invitations = extractInvitationList(payload)
  if (!invitations) {
    throw new WorkspaceApiClientError(
      "Workspace invitations payload is invalid.",
      {
        code: ERROR_CODES.INTERNAL_ERROR,
        status: response.status,
      },
    )
  }

  return invitations
}
