import { describe, expect, it } from "vitest"

import {
  archiveTask,
  assertTaskCanDelete,
  createTask,
  updateTaskTitle,
} from "./task"
import { TASK_ERROR_CODES, type TaskError } from "../errors"

describe("task domain", () => {
  it("creates a queued task with minimal semantics", () => {
    const task = createTask({
      id: "task-1",
      projectId: "project-1",
      prompt: "Investigate runtime drift",
    })

    expect(task).toMatchObject({
      id: "task-1",
      projectId: "project-1",
      prompt: "Investigate runtime drift",
      title: "Investigate runtime drift",
      status: "queued",
      archivedAt: null,
    })
  })

  it("archives a terminal task once", () => {
    const task = createTask({
      id: "task-1",
      projectId: "project-1",
      prompt: "Investigate runtime drift",
      status: "completed",
    })

    const archived = archiveTask(task, new Date("2026-03-25T00:00:00.000Z"))
    expect(archived.archivedAt?.toISOString()).toBe("2026-03-25T00:00:00.000Z")

    expect(() => archiveTask(archived)).toThrow(
      expect.objectContaining({
        code: TASK_ERROR_CODES.INVALID_ARCHIVE_STATE,
      } satisfies Partial<TaskError>),
    )
  })

  it("rejects archive for non-terminal tasks", () => {
    const task = createTask({
      id: "task-1",
      projectId: "project-1",
      prompt: "Investigate runtime drift",
      status: "running",
    })

    expect(() => archiveTask(task)).toThrow(
      expect.objectContaining({
        code: TASK_ERROR_CODES.INVALID_ARCHIVE_STATE,
      } satisfies Partial<TaskError>),
    )
  })

  it("updates title without changing identity", () => {
    const task = createTask({
      id: "task-1",
      projectId: "project-1",
      prompt: "Investigate runtime drift",
    })

    const updated = updateTaskTitle(task, "Refine runtime drift report")

    expect(updated.id).toBe("task-1")
    expect(updated.projectId).toBe("project-1")
    expect(updated.title).toBe("Refine runtime drift report")
  })

  it("allows deleting only terminal tasks", () => {
    const running = createTask({
      id: "task-1",
      projectId: "project-1",
      prompt: "Investigate runtime drift",
      status: "running",
    })

    expect(() => assertTaskCanDelete(running)).toThrow(
      expect.objectContaining({
        code: TASK_ERROR_CODES.INVALID_DELETE_STATE,
      } satisfies Partial<TaskError>),
    )

    const completed = createTask({
      id: "task-2",
      projectId: "project-1",
      prompt: "Summarize runtime drift",
      status: "completed",
    })

    expect(() => assertTaskCanDelete(completed)).not.toThrow()
  })
})
