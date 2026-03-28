import type { PrismaClient } from "@prisma/client"

import type {
  TaskRepository,
  ListProjectTasksInput,
} from "../../application/task-repository"
import type {
  CreateTaskRecordInput,
  TaskRecordStore,
} from "../../application/task-record-store"
import type { Task } from "../../domain/task"
import type { TaskRecord } from "../../application/task-read-models"
import { toTaskRecord } from "./task-mapper"

const taskReadInclude = {
  execution: {
    select: {
      executorType: true,
      executorModel: true,
      executionMode: true,
    },
  },
} as const

export class PrismaTaskRepository implements TaskRepository, TaskRecordStore {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateTaskRecordInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.task.create({
        data: {
          id: input.task.id,
          projectId: input.task.projectId,
          prompt: input.task.prompt,
          title: input.task.title,
          titleSource: input.task.titleSource,
          status: input.task.status,
          archivedAt: input.task.archivedAt,
          createdAt: input.task.createdAt,
          updatedAt: input.task.updatedAt,
          startedAt: input.task.startedAt,
          finishedAt: input.task.finishedAt,
        },
      })

      await tx.execution.create({
        data: {
          ownerType: "task",
          ownerId: input.task.id,
          executorType: input.runtimeConfig.executor,
          executorModel: input.runtimeConfig.model,
          executionMode: input.runtimeConfig.executionMode,
          workingDirectory: input.projectPath,
          status: "queued",
          createdAt: input.task.createdAt,
          updatedAt: input.task.updatedAt,
        },
      })
    })
  }

  async findById(id: string): Promise<TaskRecord | null> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: taskReadInclude,
    })

    return task ? toTaskRecord(task) : null
  }

  async listByProject(input: ListProjectTasksInput): Promise<TaskRecord[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId: input.projectId,
        ...(input.includeArchived ? {} : { archivedAt: null }),
      },
      include: taskReadInclude,
      orderBy: [{ createdAt: "desc" }],
      ...(input.limit === undefined ? {} : { take: input.limit }),
    })

    return tasks.map(toTaskRecord)
  }

  async save(task: Task): Promise<void> {
    await this.prisma.task.update({
      where: { id: task.id },
      data: {
        prompt: task.prompt,
        title: task.title,
        titleSource: task.titleSource,
        status: task.status,
        archivedAt: task.archivedAt,
        updatedAt: task.updatedAt,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt,
      },
    })
  }

  async delete(taskId: string): Promise<void> {
    await this.prisma.task.delete({
      where: { id: taskId },
    })
  }
}
