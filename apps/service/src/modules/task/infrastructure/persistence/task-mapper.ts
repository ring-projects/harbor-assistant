import type { Task as PrismaTask } from "@prisma/client"

import { createTask, type Task } from "../../domain/task"

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
