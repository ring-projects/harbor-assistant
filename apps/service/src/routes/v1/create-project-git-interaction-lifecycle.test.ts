import { describe, expect, it, vi } from "vitest"

import { createProject } from "../../modules/project/domain/project"
import { InMemoryProjectRepository } from "../../modules/project/infrastructure/in-memory-project-repository"
import { createProjectGitInteractionLifecycle } from "./create-project-git-interaction-lifecycle"

describe("createProjectGitInteractionLifecycle", () => {
  it("resolves project root path and maps path watcher changes back to project scope", async () => {
    const projectRepository = new InMemoryProjectRepository()
    await projectRepository.save(
      createProject({
        id: "project-1",
        name: "Harbor Assistant",
        normalizedPath: "/tmp/harbor-assistant",
      }),
    )

    let onPathChange:
      | ((event: { path: string; changedAt: string }) => void)
      | undefined
    const unsubscribe = vi.fn()
    const lifecycle = createProjectGitInteractionLifecycle({
      projectRepository,
      gitPathWatcher: {
        subscribe: vi.fn(async (_path, listener) => {
          onPathChange = listener
          return unsubscribe
        }),
        close: vi.fn(async () => {}),
      },
    })

    const listener = vi.fn()
    const stop = await lifecycle.subscribe("project-1", listener)

    onPathChange?.({
      path: "/tmp/harbor-assistant",
      changedAt: "2026-03-25T00:00:00.000Z",
    })

    expect(listener).toHaveBeenCalledWith({
      projectId: "project-1",
      changedAt: "2026-03-25T00:00:00.000Z",
    })

    await stop()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it("maps missing project errors to app errors for interaction delivery", async () => {
    const lifecycle = createProjectGitInteractionLifecycle({
      projectRepository: new InMemoryProjectRepository(),
      gitPathWatcher: {
        subscribe: vi.fn(),
      },
    })

    await expect(lifecycle.subscribe("missing", vi.fn())).rejects.toMatchObject(
      {
        code: "PROJECT_NOT_FOUND",
        statusCode: 404,
      },
    )
  })
})
