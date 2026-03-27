import type { FastifyInstance } from "fastify"

import { archiveTaskUseCase } from "../application/archive-task"
import { createTaskUseCase } from "../application/create-task"
import { deleteTaskUseCase } from "../application/delete-task"
import { getTaskDetailUseCase } from "../application/get-task-detail"
import { getTaskEventsUseCase } from "../application/get-task-events"
import type { ProjectTaskPort } from "../application/project-task-port"
import { resumeTaskUseCase } from "../application/resume-task"
import type { TaskEventProjection } from "../application/task-event-projection"
import type { TaskNotificationPublisher } from "../application/task-notification"
import type { TaskRecordStore } from "../application/task-record-store"
import type { TaskDetail, TaskEventStream, TaskListItem } from "../application/task-read-models"
import type { TaskRepository } from "../application/task-repository"
import type { TaskRuntimePort } from "../application/task-runtime-port"
import { listProjectTasksUseCase } from "../application/list-project-tasks"
import { updateTaskTitleUseCase } from "../application/update-task-title"
import { toTaskAppError } from "../task-app-error"
import {
  archiveTaskRouteSchema,
  createTaskRouteSchema,
  deleteTaskRouteSchema,
  getProjectTasksRouteSchema,
  getTaskEventsRouteSchema,
  getTaskRouteSchema,
  type CreateTaskBody,
  type GetProjectTasksQuery,
  type GetTaskEventsQuery,
  type ProjectIdParams,
  type ResumeTaskBody,
  type TaskIdParams,
  type UpdateTaskTitleBody,
  resumeTaskRouteSchema,
  updateTaskTitleRouteSchema,
} from "../schemas"

function toResponseTask(task: TaskDetail) {
  return {
    ...task,
    archivedAt: task.archivedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    startedAt: task.startedAt?.toISOString() ?? null,
    finishedAt: task.finishedAt?.toISOString() ?? null,
  }
}

function toResponseTaskListItem(task: TaskListItem) {
  return {
    ...task,
    archivedAt: task.archivedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    startedAt: task.startedAt?.toISOString() ?? null,
    finishedAt: task.finishedAt?.toISOString() ?? null,
  }
}

function toResponseTaskEventStream(stream: TaskEventStream) {
  return {
    taskId: stream.taskId,
    nextSequence: stream.nextSequence,
    items: stream.items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  }
}

export async function registerTaskModuleRoutes(
  app: FastifyInstance,
  options: {
    repository: TaskRepository
    taskRecordStore: TaskRecordStore
    eventProjection: TaskEventProjection
    notificationPublisher: TaskNotificationPublisher
    projectTaskPort: ProjectTaskPort
    runtimePort: TaskRuntimePort
  },
) {
  const {
    repository,
    taskRecordStore,
    eventProjection,
    notificationPublisher,
    projectTaskPort,
    runtimePort,
  } = options

  app.post<{ Body: CreateTaskBody }>(
    "/tasks",
    {
      schema: createTaskRouteSchema,
    },
    async (request, reply) => {
      try {
        const task = await createTaskUseCase(
          {
            projectTaskPort,
            taskRecordStore,
            repository,
            runtimePort,
            notificationPublisher,
          },
          request.body,
        )

        return reply.status(201).send({
          ok: true,
          task: toResponseTask(task),
        })
      } catch (error) {
        throw toTaskAppError(error)
      }
    },
  )

  app.get<{ Params: TaskIdParams }>(
    "/tasks/:taskId",
    {
      schema: getTaskRouteSchema,
    },
    async (request) => {
      try {
        const task = await getTaskDetailUseCase(repository, request.params.taskId)
        return {
          ok: true,
          task: toResponseTask(task),
        }
      } catch (error) {
        throw toTaskAppError(error)
      }
    },
  )

  app.put<{ Params: TaskIdParams; Body: UpdateTaskTitleBody }>(
    "/tasks/:taskId/title",
    {
      schema: updateTaskTitleRouteSchema,
    },
    async (request) => {
      try {
        const task = await updateTaskTitleUseCase(repository, notificationPublisher, {
          taskId: request.params.taskId,
          title: request.body.title,
        })

        return {
          ok: true,
          task: toResponseTask(task),
        }
      } catch (error) {
        throw toTaskAppError(error)
      }
    },
  )

  app.post<{ Params: TaskIdParams; Body: ResumeTaskBody }>(
    "/tasks/:taskId/resume",
    {
      schema: resumeTaskRouteSchema,
    },
    async (request) => {
      try {
        const task = await resumeTaskUseCase(
          {
            projectTaskPort,
            repository,
            runtimePort,
          },
          {
            taskId: request.params.taskId,
            prompt: request.body.prompt,
          },
        )

        return {
          ok: true,
          task: toResponseTask(task),
        }
      } catch (error) {
        throw toTaskAppError(error)
      }
    },
  )

  app.post<{ Params: TaskIdParams }>(
    "/tasks/:taskId/archive",
    {
      schema: archiveTaskRouteSchema,
    },
    async (request) => {
      try {
        const task = await archiveTaskUseCase(
          repository,
          notificationPublisher,
          request.params.taskId,
        )

        return {
          ok: true,
          task: toResponseTask(task),
        }
      } catch (error) {
        throw toTaskAppError(error)
      }
    },
  )

  app.delete<{ Params: TaskIdParams }>(
    "/tasks/:taskId",
    {
      schema: deleteTaskRouteSchema,
    },
    async (request) => {
      try {
        const result = await deleteTaskUseCase(
          repository,
          notificationPublisher,
          request.params.taskId,
        )

        return {
          ok: true,
          ...result,
        }
      } catch (error) {
        throw toTaskAppError(error)
      }
    },
  )

  app.get<{ Params: TaskIdParams; Querystring: GetTaskEventsQuery }>(
    "/tasks/:taskId/events",
    {
      schema: getTaskEventsRouteSchema,
    },
    async (request, reply) => {
      try {
        const result = await getTaskEventsUseCase(repository, eventProjection, {
          taskId: request.params.taskId,
          afterSequence: request.query.afterSequence,
          limit: request.query.limit,
        })

        return reply.status(result.isTerminal ? 200 : 206).send({
          ok: true,
          task: toResponseTask(result.task),
          events: toResponseTaskEventStream(result.events),
        })
      } catch (error) {
        throw toTaskAppError(error)
      }
    },
  )

  app.get<{ Params: ProjectIdParams; Querystring: GetProjectTasksQuery }>(
    "/projects/:projectId/tasks",
    {
      schema: getProjectTasksRouteSchema,
    },
    async (request) => {
      try {
        const tasks = await listProjectTasksUseCase(repository, {
          projectId: request.params.projectId,
          includeArchived: request.query.includeArchived,
          limit: request.query.limit,
        })

        return {
          ok: true,
          tasks: tasks.map(toResponseTaskListItem),
        }
      } catch (error) {
        throw toTaskAppError(error)
      }
    },
  )
}
