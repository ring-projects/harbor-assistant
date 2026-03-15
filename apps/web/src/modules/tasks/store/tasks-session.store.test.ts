import { createStore } from "zustand/vanilla"
import { describe, expect, it } from "vitest"

import type {
  TaskAgentEvent,
  TaskAgentEventStream,
  TaskDetail,
  TaskListItem,
} from "@/modules/tasks/contracts"

import {
  selectConversationBlocks,
  selectProjectTasks,
  selectVisiblePendingPrompt,
} from "./tasks-session.selectors"
import { createTasksSessionStoreState } from "./tasks-session.store"
import type { TasksSessionStore } from "./tasks-session.types"

function createTasksStore() {
  return createStore<TasksSessionStore>()(createTasksSessionStoreState)
}

function buildTask(
  overrides: Partial<TaskDetail & TaskListItem> = {},
): TaskDetail {
  return {
    taskId: "task-1",
    projectId: "project-1",
    prompt: "Ship it",
    title: "Ship it",
    titleSource: "prompt",
    titleUpdatedAt: null,
    model: null,
    executor: "codex",
    executionMode: "connected",
    runtimePolicy: null,
    status: "queued",
    threadId: null,
    parentTaskId: null,
    createdAt: "2026-03-13T00:00:00.000Z",
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    command: [],
    stdout: "",
    stderr: "",
    error: null,
    ...overrides,
  }
}

function buildStream(
  overrides: Partial<TaskAgentEventStream> = {},
): TaskAgentEventStream {
  return {
    taskId: "task-1",
    items: [],
    nextSequence: 0,
    ...overrides,
  }
}

function buildMessageEvent(
  overrides: Partial<TaskAgentEvent> = {},
): TaskAgentEvent {
  return {
    id: "event-1",
    taskId: "task-1",
    sequence: 1,
    eventType: "message",
    payload: {
      type: "message",
      role: "user",
      content: "hello",
    },
    createdAt: "2026-03-13T00:00:00.000Z",
    ...overrides,
  }
}

describe("tasks session store", () => {
  it("keeps task status monotonic when an older snapshot arrives later", () => {
    const store = createTasksStore()

    store.getState().applyTaskUpsert(
      buildTask({
        taskId: "task-1",
        status: "running",
      }),
    )
    store.getState().applyTaskUpsert(
      buildTask({
        taskId: "task-1",
        status: "queued",
      }),
    )

    expect(store.getState().tasksById["task-1"]?.status).toBe("running")
  })

  it("merges task events from snapshot and socket input without dropping newer items", () => {
    const store = createTasksStore()

    store.getState().hydrateTaskEvents("task-1", buildStream({
      items: [buildMessageEvent()],
      nextSequence: 1,
    }))

    store.getState().applyAgentEvent("task-1", buildMessageEvent({
      id: "event-2",
      sequence: 2,
      payload: {
        type: "message",
        role: "assistant",
        content: "live reply",
      },
    }))

    store.getState().hydrateTaskEvents("task-1", buildStream({
      items: [buildMessageEvent()],
      nextSequence: 1,
    }))

    expect(store.getState().eventStreamsByTaskId["task-1"]).toEqual({
      taskId: "task-1",
      items: [
        buildMessageEvent(),
        buildMessageEvent({
          id: "event-2",
          sequence: 2,
          payload: {
            type: "message",
            role: "assistant",
            content: "live reply",
          },
        }),
      ],
      nextSequence: 2,
    })
  })

  it("clears pending prompt after the matching user message is confirmed", () => {
    const store = createTasksStore()

    store.getState().setPendingPrompt("task-1", {
      content: "continue",
      baselineSequence: 1,
    })

    store.getState().applyAgentEvent("task-1", buildMessageEvent({
      id: "event-2",
      sequence: 2,
      payload: {
        type: "message",
        role: "user",
        content: "continue",
      },
    }))

    expect(selectVisiblePendingPrompt(store.getState(), "task-1")).toBeNull()
  })

  it("returns project tasks sorted by createdAt descending", () => {
    const store = createTasksStore()

    store.getState().hydrateProjectTasks("project-1", [
      buildTask({
        taskId: "task-1",
        createdAt: "2026-03-13T00:00:00.000Z",
      }),
      buildTask({
        taskId: "task-2",
        createdAt: "2026-03-13T00:01:00.000Z",
      }),
    ])

    expect(selectProjectTasks(store.getState(), "project-1").map((task) => task.taskId)).toEqual([
      "task-2",
      "task-1",
    ])
  })

  it("returns a stable project task array when task inputs are unchanged", () => {
    const store = createTasksStore()

    store.getState().hydrateProjectTasks("project-1", [
      buildTask({
        taskId: "task-1",
      }),
    ])

    const first = selectProjectTasks(store.getState(), "project-1")
    store.getState().setDraft("task-1", "draft update")
    const second = selectProjectTasks(store.getState(), "project-1")

    expect(second).toBe(first)
  })

  it("builds pending conversation blocks from normalized state", () => {
    const store = createTasksStore()

    store.getState().setPendingPrompt("task-1", {
      content: "draft message",
      baselineSequence: 3,
    })

    expect(selectConversationBlocks(store.getState(), "task-1")).toEqual([
      {
        id: "pending-3",
        type: "message",
        role: "user",
        content: "draft message",
        timestamp: null,
        pending: true,
      },
    ])
  })

  it("returns stable conversation blocks when stream and pending prompt are unchanged", () => {
    const store = createTasksStore()

    store.getState().hydrateTaskEvents("task-1", buildStream({
      items: [buildMessageEvent()],
      nextSequence: 1,
    }))

    const first = selectConversationBlocks(store.getState(), "task-1")
    store.getState().setDraft("task-1", "draft update")
    const second = selectConversationBlocks(store.getState(), "task-1")

    expect(second).toBe(first)
  })
})
