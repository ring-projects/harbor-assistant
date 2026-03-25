import {
  normalizeNonNegativeInteger,
  normalizePositiveInteger,
} from "../../../utils"
import type {
  InteractionSubscribeRequest,
  InteractionTopic,
  InteractionTopicKind,
} from "../application/ports"

function normalizeIdentifier(value: string | undefined) {
  const normalizedValue = value?.trim() ?? ""
  return normalizedValue || null
}

export function interactionTopicKey(topic: InteractionTopic) {
  return `${topic.kind}:${topic.id}`
}

export function interactionTopicRoom(topic: InteractionTopic) {
  return interactionTopicKey(topic)
}

function isTopicKind(value: string | undefined): value is InteractionTopicKind {
  return (
    value === "project" ||
    value === "task" ||
    value === "task-events" ||
    value === "project-git"
  )
}

function normalizeTopic(value: unknown): InteractionTopic | null {
  if (typeof value !== "object" || value === null) {
    return null
  }

  const topic = value as {
    kind?: string
    id?: string
  }

  const id = normalizeIdentifier(topic.id)
  if (!id || !isTopicKind(topic.kind)) {
    return null
  }

  return {
    kind: topic.kind,
    id,
  }
}

export type ParsedInteractionSubscription =
  | {
      topic: InteractionTopic & {
        kind: "project"
      }
      room: string
      limit: number
    }
  | {
      topic: InteractionTopic & {
        kind: "task"
      }
      room: string
    }
  | {
      topic: InteractionTopic & {
        kind: "task-events"
      }
      room: string
      afterSequence: number
      limit: number
    }
  | {
      topic: InteractionTopic & {
        kind: "project-git"
      }
      room: string
    }

export function parseInteractionSubscription(
  payload: Partial<InteractionSubscribeRequest> | undefined,
): ParsedInteractionSubscription | null {
  const topic = normalizeTopic(payload?.topic)
  if (!topic) {
    return null
  }

  switch (topic.kind) {
    case "project": {
      const projectTopic = topic as InteractionTopic & {
        kind: "project"
      }
      return {
        topic: projectTopic,
        room: interactionTopicRoom(projectTopic),
        limit: normalizePositiveInteger(payload?.limit, 200),
      }
    }
    case "task": {
      const taskTopic = topic as InteractionTopic & {
        kind: "task"
      }
      return {
        topic: taskTopic,
        room: interactionTopicRoom(taskTopic),
      }
    }
    case "task-events": {
      const taskEventsTopic = topic as InteractionTopic & {
        kind: "task-events"
      }
      return {
        topic: taskEventsTopic,
        room: interactionTopicRoom(taskEventsTopic),
        afterSequence: normalizeNonNegativeInteger(payload?.afterSequence, 0),
        limit: normalizePositiveInteger(payload?.limit, 500),
      }
    }
    case "project-git": {
      const projectGitTopic = topic as InteractionTopic & {
        kind: "project-git"
      }
      return {
        topic: projectGitTopic,
        room: interactionTopicRoom(projectGitTopic),
      }
    }
  }
}
