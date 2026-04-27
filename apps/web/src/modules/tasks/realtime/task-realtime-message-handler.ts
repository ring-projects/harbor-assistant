import type { QueryClient } from "@tanstack/react-query"

import { toStringOrNull } from "@/lib/protocol"
import { gitQueryKeys } from "@/modules/git"
import { useTasksSessionStore } from "@/modules/tasks/store"
import {
  extractTaskEvents,
  normalizeTaskCandidate,
  normalizeTaskEvent,
  toTaskStatus,
} from "@/modules/tasks/api/task-payload"

import type {
  InteractionEventMessage,
  InteractionMessageEnvelope,
  InteractionSnapshotMessage,
  InteractionTopic,
} from "./task-realtime-protocol"

export class TaskRealtimeMessageHandler {
  constructor(private readonly getQueryClient: () => QueryClient | null) {}

  handleMessage(payload: InteractionMessageEnvelope) {
    const topic = payload?.topic
    const message = payload?.message
    if (!topic || !message) {
      return
    }

    if (message.kind === "snapshot") {
      this.handleSnapshot(topic, message)
      return
    }

    if (message.kind === "event") {
      this.handleEvent(topic, message)
    }
  }

  private handleSnapshot(
    topic: InteractionTopic,
    message: InteractionSnapshotMessage,
  ) {
    const data = message.data ?? {}

    switch (message.name) {
      case "task": {
        const task = normalizeTaskCandidate(data.task)
        if (!task) {
          return
        }

        useTasksSessionStore.getState().applyTaskUpsert(task)
        return
      }
      case "task_events": {
        if (topic.kind !== "task-events") {
          return
        }

        const events = extractTaskEvents(data, {
          fallbackTaskId: topic.id,
        })
        if (!events) {
          return
        }

        useTasksSessionStore.getState().hydrateTaskEvents(topic.id, events)
      }
    }
  }

  private handleEvent(
    topic: InteractionTopic,
    message: InteractionEventMessage,
  ) {
    const data = message.data ?? {}

    switch (message.name) {
      case "task_upsert": {
        const task = normalizeTaskCandidate(data.task)
        if (!task) {
          return
        }

        useTasksSessionStore.getState().applyTaskUpsert(task)
        return
      }
      case "task_deleted": {
        const taskId = toStringOrNull(data.taskId)
        const orchestrationId =
          toStringOrNull(data.orchestrationId) ??
          useTasksSessionStore.getState().tasksById[topic.id]?.orchestrationId

        if (!taskId || !orchestrationId) {
          return
        }

        useTasksSessionStore.getState().deleteTask(orchestrationId, taskId)
        return
      }
      case "task_status_changed": {
        if (topic.kind !== "task") {
          return
        }

        const status = toTaskStatus(data.status)
        if (!status) {
          return
        }

        useTasksSessionStore.getState().applyTaskStatus(topic.id, status)
        return
      }
      case "task_ended": {
        if (topic.kind !== "task" && topic.kind !== "task-events") {
          return
        }

        const status = toTaskStatus(data.status)
        if (!status) {
          return
        }

        useTasksSessionStore.getState().applyTaskEnd(topic.id, status)

        const queryClient = this.getQueryClient()
        if (!queryClient) {
          return
        }

        const currentTask = useTasksSessionStore.getState().tasksById[topic.id]
        if (currentTask?.projectId) {
          void queryClient.invalidateQueries({
            queryKey: gitQueryKeys.byProject(currentTask.projectId),
          })
          return
        }

        void queryClient.invalidateQueries({
          queryKey: gitQueryKeys.all,
        })
        return
      }
      case "task_event": {
        if (topic.kind !== "task-events") {
          return
        }

        const event = normalizeTaskEvent(topic.id, data.event)
        if (!event) {
          return
        }

        useTasksSessionStore.getState().applyAgentEvent(topic.id, event)
        return
      }
      case "project_git_changed": {
        if (topic.kind !== "project-git") {
          return
        }

        const queryClient = this.getQueryClient()
        if (!queryClient) {
          return
        }

        void queryClient.invalidateQueries({
          queryKey: gitQueryKeys.byProject(topic.id),
        })
      }
    }
  }
}
