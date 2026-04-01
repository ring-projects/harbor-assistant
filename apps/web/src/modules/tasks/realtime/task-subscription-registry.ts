import {
  selectLastSequence,
  useTasksSessionStore,
} from "@/modules/tasks/store"

import type {
  InteractionSubscribeRequest,
  InteractionTopic,
} from "./task-realtime-protocol"

type SubscriptionKind = InteractionTopic["kind"]
type RefStore = Map<SubscriptionKind, Map<string, number>>

const TASK_EVENTS_LIMIT = 500

export class TaskSubscriptionRegistry {
  private refs: RefStore = new Map([
    ["project-git", new Map()],
    ["task", new Map()],
    ["task-events", new Map()],
  ])

  constructor(
    private readonly emitSubscribe: (payload: InteractionSubscribeRequest) => void,
    private readonly emitUnsubscribe: (payload: InteractionSubscribeRequest) => void,
  ) {}

  subscribeProjectGit(projectId: string) {
    return this.subscribe("project-git", projectId)
  }

  subscribeTask(taskId: string) {
    return this.subscribe("task", taskId)
  }

  subscribeTaskEvents(taskId: string) {
    return this.subscribe("task-events", taskId)
  }

  resubscribeAll() {
    for (const [kind, topicRefs] of this.refs.entries()) {
      for (const id of topicRefs.keys()) {
        this.emitSubscribe(this.buildSubscribeRequest(kind, id))
      }
    }
  }

  private subscribe(kind: SubscriptionKind, rawId: string) {
    const id = rawId.trim()
    if (!id) {
      return () => {}
    }

    const topicRefs = this.getRefs(kind)
    const current = topicRefs.get(id) ?? 0
    topicRefs.set(id, current + 1)

    if (current === 0) {
      this.emitSubscribe(this.buildSubscribeRequest(kind, id))
    }

    return () => {
      const next = (topicRefs.get(id) ?? 1) - 1
      if (next <= 0) {
        topicRefs.delete(id)
        this.emitUnsubscribe({
          topic: {
            kind,
            id,
          },
        })
        return
      }

      topicRefs.set(id, next)
    }
  }

  private buildSubscribeRequest(
    kind: SubscriptionKind,
    id: string,
  ): InteractionSubscribeRequest {
    const topic: InteractionTopic = {
      kind,
      id,
    }

    switch (kind) {
      case "task-events":
        return {
          topic,
          afterSequence: selectLastSequence(useTasksSessionStore.getState(), id),
          limit: TASK_EVENTS_LIMIT,
        }
      default:
        return { topic }
    }
  }

  private getRefs(kind: SubscriptionKind) {
    return this.refs.get(kind) ?? new Map<string, number>()
  }
}
