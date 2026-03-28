import type { Prisma, Task as PrismaTask } from "@prisma/client"

import { createTask, type Task } from "../../domain/task"
import { attachTaskRuntime, type TaskRecord } from "../../application/task-read-models"

export function toDomainTask(task: PrismaTask): Task {
  return createTask({
    id: task.id,
    projectId: task.projectId,
    prompt: task.prompt,
    title: task.title,
    titleSource: task.titleSource,
    status: task.status,
    archivedAt: task.archivedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
  })
}

type PrismaTaskWithExecution = Prisma.TaskGetPayload<{
  include: {
    execution: {
      select: {
        executorType: true
        executorModel: true
        executionMode: true
      }
    }
  }
}>

export function toTaskRecord(task: PrismaTaskWithExecution): TaskRecord {
  return attachTaskRuntime(toDomainTask(task), {
    executor: task.execution?.executorType ?? null,
    model: task.execution?.executorModel ?? null,
    executionMode: task.execution?.executionMode ?? null,
  })
}
