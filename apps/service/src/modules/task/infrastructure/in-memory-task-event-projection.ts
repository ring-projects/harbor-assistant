import type {
  GetTaskEventsInput,
  TaskEventProjection,
} from "../application/task-event-projection"
import type {
  TaskEventItem,
  TaskEventStream,
} from "../application/task-read-models"

export class InMemoryTaskEventProjection implements TaskEventProjection {
  private readonly eventsByTaskId = new Map<string, TaskEventItem[]>()

  constructor(seed?: Record<string, TaskEventItem[]>) {
    for (const [taskId, items] of Object.entries(seed ?? {})) {
      this.eventsByTaskId.set(
        taskId,
        [...items].sort((a, b) => a.sequence - b.sequence),
      )
    }
  }

  async getTaskEvents(input: GetTaskEventsInput): Promise<TaskEventStream> {
    const afterSequence = input.afterSequence ?? 0
    const limit = input.limit ?? 200
    const items = (this.eventsByTaskId.get(input.taskId) ?? [])
      .filter((item) => item.sequence > afterSequence)
      .slice(0, limit)
    const nextSequence =
      items.length > 0
        ? items[items.length - 1]!.sequence + 1
        : afterSequence + 1

    return {
      taskId: input.taskId,
      items,
      nextSequence,
    }
  }
}
