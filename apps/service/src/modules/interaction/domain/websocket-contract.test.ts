import { describe, expect, it } from "vitest"

import {
  errorEnvelope,
  projectGitChangedEventEnvelope,
  taskDeletedEventEnvelope,
  taskSnapshotEnvelope,
  taskEventsSnapshotEnvelope,
  taskUpsertEventEnvelope,
} from "./websocket-contract"

describe("websocket interaction contract", () => {
  it("builds task snapshot and live task envelopes", () => {
    expect(
      taskSnapshotEnvelope({
        topic: {
          kind: "task",
          id: "task-1",
        },
        task: {
          id: "task-1",
          projectId: "project-1",
          orchestrationId: "orch-1",
          title: "Investigate runtime drift",
          titleSource: "prompt",
          executor: "codex",
          model: null,
          executionMode: "safe",
          effort: null,
          status: "queued",
          archivedAt: null,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
          startedAt: null,
          finishedAt: null,
        },
      }),
    ).toEqual({
      event: "interaction:message",
      payload: {
        topic: {
          kind: "task",
          id: "task-1",
        },
        message: {
          kind: "snapshot",
          name: "task",
          data: {
            task: {
              id: "task-1",
              projectId: "project-1",
              orchestrationId: "orch-1",
              title: "Investigate runtime drift",
              titleSource: "prompt",
              executor: "codex",
              model: null,
              executionMode: "safe",
              effort: null,
              status: "queued",
              archivedAt: null,
              createdAt: "2026-03-24T00:00:00.000Z",
              updatedAt: "2026-03-24T00:00:00.000Z",
              startedAt: null,
              finishedAt: null,
            },
          },
        },
      },
    })

    expect(
      taskUpsertEventEnvelope({
        topic: {
          kind: "task",
          id: "task-1",
        },
        task: {
          id: "task-2",
          projectId: "project-1",
          orchestrationId: "orch-2",
          title: "Investigate runtime drift",
          titleSource: "prompt",
          executor: "codex",
          model: null,
          executionMode: "safe",
          effort: null,
          status: "running",
          archivedAt: null,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
          startedAt: null,
          finishedAt: null,
        },
      }),
    ).toEqual({
      event: "interaction:message",
      payload: {
        topic: {
          kind: "task",
          id: "task-1",
        },
        message: {
          kind: "event",
          name: "task_upsert",
          data: {
            task: {
              id: "task-2",
              projectId: "project-1",
              orchestrationId: "orch-2",
              title: "Investigate runtime drift",
              titleSource: "prompt",
              executor: "codex",
              model: null,
              executionMode: "safe",
              effort: null,
              status: "running",
              archivedAt: null,
              createdAt: "2026-03-24T00:00:00.000Z",
              updatedAt: "2026-03-24T00:00:00.000Z",
              startedAt: null,
              finishedAt: null,
            },
          },
        },
      },
    })

    expect(
      taskDeletedEventEnvelope({
        topic: {
          kind: "task",
          id: "task-1",
        },
        taskId: "task-1",
        projectId: "project-1",
        orchestrationId: "orch-1",
      }),
    ).toEqual({
      event: "interaction:message",
      payload: {
        topic: {
          kind: "task",
          id: "task-1",
        },
        message: {
          kind: "event",
          name: "task_deleted",
          data: {
            taskId: "task-1",
            projectId: "project-1",
            orchestrationId: "orch-1",
          },
        },
      },
    })
  })

  it("builds task-events snapshot envelope", () => {
    expect(
      taskEventsSnapshotEnvelope({
        topic: {
          kind: "task-events",
          id: "task-1",
        },
        status: "running",
        afterSequence: 3,
        items: [],
        nextSequence: 4,
        terminal: false,
      }),
    ).toEqual({
      event: "interaction:message",
      payload: {
        topic: {
          kind: "task-events",
          id: "task-1",
        },
        message: {
          kind: "snapshot",
          name: "task_events",
          data: {
            status: "running",
            afterSequence: 3,
            items: [],
            nextSequence: 4,
            terminal: false,
          },
        },
      },
    })
  })

  it("builds project git change and unified error envelopes", () => {
    expect(
      projectGitChangedEventEnvelope({
        topic: {
          kind: "project-git",
          id: "project-1",
        },
        changedAt: "2026-03-24T12:00:00.000Z",
      }),
    ).toEqual({
      event: "interaction:message",
      payload: {
        topic: {
          kind: "project-git",
          id: "project-1",
        },
        message: {
          kind: "event",
          name: "project_git_changed",
          data: {
            changedAt: "2026-03-24T12:00:00.000Z",
          },
        },
      },
    })

    expect(
      errorEnvelope({
        topic: {
          kind: "task",
          id: "task-1",
        },
        error: {
          code: "PROJECT_NOT_FOUND",
          message: "Project not found.",
        },
      }),
    ).toEqual({
      event: "interaction:message",
      payload: {
        topic: {
          kind: "task",
          id: "task-1",
        },
        message: {
          kind: "error",
          error: {
            code: "PROJECT_NOT_FOUND",
            message: "Project not found.",
          },
        },
      },
    })
  })
})
