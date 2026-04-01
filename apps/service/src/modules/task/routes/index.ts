import type { FastifyInstance } from "fastify"

import { archiveTaskUseCase } from "../application/archive-task"
import { cancelTaskUseCase } from "../application/cancel-task"
import { createTaskUseCase } from "../application/create-task"
import { deleteTaskUseCase } from "../application/delete-task"
import { getTaskUseCase } from "../application/get-task"
import { getTaskEventsUseCase } from "../application/get-task-events"
import type { ProjectTaskPort } from "../application/project-task-port"
import { resumeTaskUseCase } from "../application/resume-task"
import type { TaskEventProjection } from "../application/task-event-projection"
import type { TaskInputFileStore } from "../application/task-input-image-store"
import type { TaskNotificationPublisher } from "../application/task-notification"
import type { TaskRecordStore } from "../application/task-record-store"
import type { TaskRepository } from "../application/task-repository"
import type { TaskRuntimePort } from "../application/task-runtime-port"
import { uploadTaskInputFileUseCase } from "../application/upload-task-input-image"
import { updateTaskTitleUseCase } from "../application/update-task-title"
import { toTaskAppError } from "../task-app-error"
import {
  archiveTaskRouteSchema,
  cancelTaskRouteSchema,
  deleteTaskRouteSchema,
  getTaskEventsRouteSchema,
  getTaskRouteSchema,
  type CancelTaskBody,
  type GetTaskEventsQuery,
  type ProjectIdParams,
  type ResumeTaskBody,
  type TaskIdParams,
  type UploadTaskInputImageBody,
  type UpdateTaskTitleBody,
  resumeTaskRouteSchema,
  uploadTaskInputImageRouteSchema,
  updateTaskTitleRouteSchema,
} from "../schemas"

export async function registerTaskModuleRoutes(
  app: FastifyInstance,
  options: {
    repository: TaskRepository
    taskRecordStore: TaskRecordStore
    eventProjection: TaskEventProjection
    notificationPublisher: TaskNotificationPublisher
    projectTaskPort: ProjectTaskPort
    taskInputFileStore: TaskInputFileStore
    runtimePort: TaskRuntimePort
  },
) {
  const {
    repository,
    taskRecordStore,
    eventProjection,
    notificationPublisher,
    projectTaskPort,
    taskInputFileStore,
    runtimePort,
  } = options

  async function handleTaskInputFileUpload(
    request: {
      params: ProjectIdParams
      body: UploadTaskInputImageBody
    },
  ) {
    try {
      const result = await uploadTaskInputFileUseCase(
        {
          projectTaskPort,
          taskInputFileStore,
        },
        {
          projectId: request.params.projectId,
          ...request.body,
        },
      )

      return {
        ok: true,
        ...result,
      }
    } catch (error) {
      throw toTaskAppError(error)
    }
  }

  app.post<{ Params: ProjectIdParams; Body: UploadTaskInputImageBody }>(
    "/projects/:projectId/task-input-files",
    {
      schema: uploadTaskInputImageRouteSchema,
    },
    handleTaskInputFileUpload,
  )

  app.post<{ Params: ProjectIdParams; Body: UploadTaskInputImageBody }>(
    "/projects/:projectId/task-input-images",
    {
      schema: uploadTaskInputImageRouteSchema,
    },
    async (request) => {
      try {
        return await handleTaskInputFileUpload(request)
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
        const task = await getTaskUseCase(repository, request.params.taskId)
        return {
          ok: true,
          task,
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
          task,
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
            items: request.body.items,
            model: request.body.model,
            effort: request.body.effort,
          },
        )

        return {
          ok: true,
          task,
        }
      } catch (error) {
        throw toTaskAppError(error)
      }
    },
  )

  app.post<{ Params: TaskIdParams; Body: CancelTaskBody }>(
    "/tasks/:taskId/cancel",
    {
      schema: cancelTaskRouteSchema,
    },
    async (request) => {
      try {
        const task = await cancelTaskUseCase(
          {
            repository,
            runtimePort,
          },
          {
            taskId: request.params.taskId,
            reason: request.body?.reason,
          },
        )

        return {
          ok: true,
          task,
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
          task,
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
          task: result.task,
          events: result.events,
        })
      } catch (error) {
        throw toTaskAppError(error)
      }
    },
  )
}
