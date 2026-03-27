import type {
  TaskAgentEvent,
  TaskAgentEventStream,
} from "@/modules/tasks/contracts"

export function mergeTaskEventStreams(
  current: TaskAgentEventStream | null | undefined,
  incoming: TaskAgentEventStream | null | undefined,
): TaskAgentEventStream | null {
  if (!incoming) {
    return current ?? null
  }

  if (!current || current.items.length === 0) {
    return incoming
  }

  if (incoming.items.length === 0) {
    return current
  }

  const currentLast = current.items.at(-1)
  const incomingFirst = incoming.items[0]
  if (currentLast && incomingFirst && incomingFirst.sequence > currentLast.sequence) {
    return {
      taskId: incoming.taskId || current.taskId || "",
      items: [...current.items, ...incoming.items],
      nextSequence: Math.max(
        current.nextSequence,
        incoming.nextSequence,
        incoming.items.at(-1)?.sequence ?? 0,
      ),
    }
  }

  const currentFirst = current.items[0]
  const incomingLast = incoming.items.at(-1)
  if (currentFirst && incomingLast && incomingLast.sequence < currentFirst.sequence) {
    return {
      taskId: incoming.taskId || current.taskId || "",
      items: [...incoming.items, ...current.items],
      nextSequence: Math.max(
        current.nextSequence,
        incoming.nextSequence,
        currentLast?.sequence ?? 0,
      ),
    }
  }

  const itemsById = new Map<string, TaskAgentEvent>()

  for (const event of current?.items ?? []) {
    itemsById.set(event.id, event)
  }

  for (const event of incoming.items) {
    itemsById.set(event.id, event)
  }

  const items = [...itemsById.values()].sort(
    (left, right) => left.sequence - right.sequence,
  )

  return {
    taskId: incoming.taskId || current?.taskId || "",
    items,
    nextSequence: Math.max(
      current?.nextSequence ?? 0,
      incoming.nextSequence,
      items.at(-1)?.sequence ?? 0,
    ),
  }
}

export function mergeTaskAgentEvent(
  current: TaskAgentEventStream | null | undefined,
  event: TaskAgentEvent,
): TaskAgentEventStream {
  if (!current || current.items.length === 0) {
    return {
      taskId: event.taskId,
      items: [event],
      nextSequence: event.sequence,
    }
  }

  const lastEvent = current.items.at(-1)
  if (lastEvent && event.sequence > lastEvent.sequence) {
    return {
      taskId: current.taskId || event.taskId,
      items: [...current.items, event],
      nextSequence: Math.max(current.nextSequence, event.sequence),
    }
  }

  return mergeTaskEventStreams(current, {
    taskId: event.taskId,
    items: [event],
    nextSequence: event.sequence,
  }) ?? {
    taskId: event.taskId,
    items: [event],
    nextSequence: event.sequence,
  }
}
