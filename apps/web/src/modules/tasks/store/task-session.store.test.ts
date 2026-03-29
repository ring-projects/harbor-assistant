import { createStore } from "zustand/vanilla"
import { describe, expect, it } from "vitest"

import type {
  TaskAgentEvent,
  TaskAgentEventStream,
  TaskDetail,
  TaskListItem,
} from "@/modules/tasks/contracts"
import type { TaskInput } from "@/modules/tasks/lib"

import {
  selectProjectTasks,
  selectVisiblePendingPrompt,
} from "./task-session.selectors"
import { createTasksSessionStoreState } from "./task-session.store"
import type { TasksSessionStore } from "./task-session.types"
import { selectConversationBlocks } from "@/modules/tasks/view-models"

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
    model: null,
    executor: "codex",
    executionMode: "connected",
    effort: null,
    status: "queued",
    archivedAt: null,
    createdAt: "2026-03-13T00:00:00.000Z",
    startedAt: null,
    finishedAt: null,
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

function buildTaskInput(input: TaskInput = "hello"): TaskInput {
  return input
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
      input: buildTaskInput("continue"),
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
      input: buildTaskInput("draft message"),
    })

    expect(selectConversationBlocks(store.getState(), "task-1")).toEqual([
      {
        id: "pending-3",
        type: "message",
        role: "user",
        content: "draft message",
        attachments: [],
        timestamp: null,
        pending: true,
      },
    ])
  })

  it("builds pending attachment blocks from structured input", () => {
    const store = createTasksStore()

    store.getState().setPendingPrompt("task-1", {
      content: "Attached 1 image",
      baselineSequence: 4,
      input: [
        {
          type: "local_image",
          path: ".harbor/task-input-images/example.png",
        },
      ],
    })

    expect(selectConversationBlocks(store.getState(), "task-1")).toEqual([
      {
        id: "pending-4",
        type: "message",
        role: "user",
        content: "",
        attachments: [
          {
            type: "local_image",
            path: ".harbor/task-input-images/example.png",
          },
        ],
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

  it("updates draft attachments without affecting task query selectors", () => {
    const store = createTasksStore()

    store.getState().hydrateProjectTasks("project-1", [
      buildTask({
        taskId: "task-1",
      }),
    ])

    const first = selectProjectTasks(store.getState(), "project-1")
    store.getState().setDraftAttachments("task-1", [
      {
        path: ".harbor/task-input-images/example.png",
        mediaType: "image/png",
        name: "example.png",
        size: 1024,
      },
    ])
    const second = selectProjectTasks(store.getState(), "project-1")

    expect(second).toBe(first)
    expect(store.getState().chatUiByTaskId["task-1"]?.draftAttachments).toEqual([
      {
        path: ".harbor/task-input-images/example.png",
        mediaType: "image/png",
        name: "example.png",
        size: 1024,
      },
    ])
  })

  it("replaces the visible project task list from query snapshots", () => {
    const store = createTasksStore()

    store.getState().hydrateProjectTasks("project-1", [
      buildTask({
        taskId: "task-1",
      }),
      buildTask({
        taskId: "task-2",
      }),
    ])

    store.getState().hydrateProjectTasks("project-1", [
      buildTask({
        taskId: "task-2",
      }),
    ])

    expect(selectProjectTasks(store.getState(), "project-1").map((task) => task.taskId)).toEqual([
      "task-2",
    ])
  })

  it("keeps archived tasks in project state for archived views", () => {
    const store = createTasksStore()

    store.getState().hydrateProjectTasks("project-1", [
      buildTask({
        taskId: "task-1",
      }),
    ])

    store.getState().applyTaskUpsert(buildTask({
      taskId: "task-1",
      archivedAt: "2026-03-18T08:00:00.000Z",
    }))

    expect(selectProjectTasks(store.getState(), "project-1").map((task) => task.taskId)).toEqual([
      "task-1",
    ])
    expect(store.getState().tasksById["task-1"]?.archivedAt).toBe(
      "2026-03-18T08:00:00.000Z",
    )
  })

  it("deletes a task from state and event caches", () => {
    const store = createTasksStore()

    store.getState().hydrateProjectTasks("project-1", [
      buildTask({
        taskId: "task-1",
      }),
    ])
    store.getState().hydrateTaskEvents("task-1", buildStream({
      items: [buildMessageEvent()],
      nextSequence: 1,
    }))
    store.getState().setDraft("task-1", "draft")

    store.getState().deleteTask("project-1", "task-1")

    expect(selectProjectTasks(store.getState(), "project-1")).toEqual([])
    expect(store.getState().tasksById["task-1"]).toBeUndefined()
    expect(store.getState().eventStreamsByTaskId["task-1"]).toBeUndefined()
    expect(store.getState().chatUiByTaskId["task-1"]).toBeUndefined()
  })
})
