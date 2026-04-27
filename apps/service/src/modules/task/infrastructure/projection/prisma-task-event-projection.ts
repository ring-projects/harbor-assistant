import { Prisma, type PrismaClient } from "@prisma/client"

import type {
  GetTaskEventsInput,
  TaskEventProjection,
} from "../../application/task-event-projection"
import type { TaskEventStream } from "../../application/task-read-models"

function parseJsonObject(
  rawPayload: Prisma.JsonValue,
): Record<string, unknown> {
  if (
    rawPayload &&
    typeof rawPayload === "object" &&
    !Array.isArray(rawPayload)
  ) {
    return rawPayload as Record<string, unknown>
  }

  return {
    value: rawPayload,
  }
}

export class PrismaTaskEventProjection implements TaskEventProjection {
  constructor(private readonly prisma: PrismaClient) {}

  async getTaskEvents(input: GetTaskEventsInput): Promise<TaskEventStream> {
    const afterSequence = input.afterSequence ?? 0
    const limit = input.limit ?? 200
    const execution = await this.prisma.execution.findUnique({
      where: {
        ownerId: input.taskId,
      },
      select: {
        id: true,
      },
    })

    if (!execution) {
      return {
        taskId: input.taskId,
        items: [],
        nextSequence: afterSequence + 1,
      }
    }

    const rows = await this.prisma.executionEvent.findMany({
      where: {
        executionId: execution.id,
        sequence: {
          gt: afterSequence,
        },
      },
      orderBy: [{ sequence: "asc" }],
      take: limit,
    })

    const items = rows.map((row) => ({
      id: row.id,
      taskId: input.taskId,
      sequence: row.sequence,
      eventType: row.rawEventType,
      payload: parseJsonObject(row.rawPayload),
      createdAt: row.createdAt,
    }))

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
