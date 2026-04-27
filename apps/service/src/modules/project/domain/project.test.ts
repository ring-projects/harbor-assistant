import { describe, expect, it } from "vitest"

import {
  archiveProject,
  createProject,
  relocateProjectRoot,
  restoreProject,
  updateProjectProfile,
  updateProjectSettings,
} from "./project"
import { PROJECT_ERROR_CODES, ProjectError } from "../errors"

describe("project domain", () => {
  it("creates a project with default settings", () => {
    const now = new Date("2026-03-24T00:00:00.000Z")

    const project = createProject({
      id: "project-1",
      name: "Harbor Assistant",
      normalizedPath: "/tmp/harbor-assistant",
      now,
    })

    expect(project.slug).toBe("harbor-assistant")
    expect(project.status).toBe("active")
    expect(project.createdAt).toBe(now)
    expect(project.settings.retention.logRetentionDays).toBe(30)
  })

  it("creates a git-backed project without a local path", () => {
    const project = createProject({
      id: "project-1",
      name: "Harbor Assistant",
      source: {
        type: "git",
        repositoryUrl: "https://github.com/acme/harbor-assistant.git",
        branch: "main",
      },
    })

    expect(project.source).toEqual({
      type: "git",
      repositoryUrl: "https://github.com/acme/harbor-assistant.git",
      branch: "main",
    })
    expect(project.rootPath).toBeNull()
    expect(project.normalizedPath).toBeNull()
  })

  it("rejects invalid settings updates", () => {
    const project = createProject({
      id: "project-1",
      name: "Harbor Assistant",
      normalizedPath: "/tmp/harbor-assistant",
    })

    expect(() =>
      updateProjectSettings(project, {
        retention: { logRetentionDays: 0 },
      }),
    ).toThrow(ProjectError)
  })

  it("archives and restores project lifecycle", () => {
    const now = new Date("2026-03-24T00:00:00.000Z")
    const archivedAt = new Date("2026-03-25T00:00:00.000Z")
    const restoredAt = new Date("2026-03-26T00:00:00.000Z")

    const project = createProject({
      id: "project-1",
      name: "Harbor Assistant",
      normalizedPath: "/tmp/harbor-assistant",
      now,
    })

    const archived = archiveProject(project, archivedAt)
    expect(archived.status).toBe("archived")
    expect(archived.archivedAt).toBe(archivedAt)

    const restored = restoreProject(archived, restoredAt)
    expect(restored.status).toBe("active")
    expect(restored.archivedAt).toBeNull()
    expect(restored.updatedAt).toBe(restoredAt)
  })

  it("uses structured error codes for invalid lifecycle transitions", () => {
    const project = createProject({
      id: "project-1",
      name: "Harbor Assistant",
      normalizedPath: "/tmp/harbor-assistant",
    })

    try {
      archiveProject(archiveProject(project))
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectError)
      expect((error as ProjectError).code).toBe(
        PROJECT_ERROR_CODES.INVALID_STATE,
      )
    }
  })

  it("updates project profile and regenerates slug", () => {
    const project = createProject({
      id: "project-1",
      name: "Harbor Assistant",
      normalizedPath: "/tmp/harbor-assistant",
    })

    const updated = updateProjectProfile(project, {
      name: "Harbor Service",
      description: "Core service workspace",
    })

    expect(updated.name).toBe("Harbor Service")
    expect(updated.slug).toBe("harbor-service")
    expect(updated.description).toBe("Core service workspace")
  })

  it("relocates project root", () => {
    const project = createProject({
      id: "project-1",
      name: "Harbor Assistant",
      normalizedPath: "/tmp/harbor-assistant",
    })

    const relocated = relocateProjectRoot(project, {
      normalizedPath: "/tmp/harbor-service",
    })

    expect(relocated.normalizedPath).toBe("/tmp/harbor-service")
    expect(relocated.rootPath).toBe("/tmp/harbor-service")
  })
})
