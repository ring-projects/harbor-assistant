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
