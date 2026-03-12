import { mkdtemp, mkdir, readFile, readlink, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createProjectSkillBridgeService } from "./project-skill-bridge.service"

async function createTempDir(prefix: string) {
  return mkdtemp(path.join(tmpdir(), prefix))
}

function buildProject(projectPath: string) {
  return {
    id: "project-1",
    name: "Project One",
    slug: "project-one",
    rootPath: projectPath,
    normalizedPath: projectPath,
    description: null,
    status: "active" as const,
    lastOpenedAt: null,
    createdAt: new Date("2026-03-12T00:00:00.000Z"),
    updatedAt: new Date("2026-03-12T00:00:00.000Z"),
    archivedAt: null,
    path: projectPath,
  }
}

describe("createProjectSkillBridgeService", () => {
  const tempRoots: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0, tempRoots.length).map((root) =>
        rm(root, { recursive: true, force: true }),
      ),
    )
  })

  it("creates Harbor skill bridges inside the project and updates git exclude", async () => {
    const harborHomeDirectory = await createTempDir("harbor-skill-home-")
    const projectPath = await createTempDir("harbor-skill-project-")
    tempRoots.push(harborHomeDirectory, projectPath)

    await mkdir(path.join(projectPath, ".git", "info"), { recursive: true })
    const profileSkillRoot = path.join(
      harborHomeDirectory,
      "skills",
      "profiles",
      "default",
      "fix-tests",
    )
    await mkdir(profileSkillRoot, { recursive: true })

    const service = createProjectSkillBridgeService({
      harborHomeDirectory,
      projectRepository: {
        getProjectById: vi.fn(async () => buildProject(projectPath)),
      },
    })

    const state = await service.ensureProjectSkillBridge({
      projectId: "project-1",
      profile: "default",
    })

    expect(state.linkedSkillNames).toEqual(["fix-tests"])

    const bridgePath = path.join(
      projectPath,
      ".codex",
      "skills",
      "harbor-fix-tests",
    )
    expect(await readlink(bridgePath)).toBe(
      path.join(harborHomeDirectory, "projects", "project-1", "skills", "fix-tests"),
    )
    expect(
      await realpath(
        path.join(harborHomeDirectory, "projects", "project-1", "skills", "fix-tests"),
      ),
    ).toBe(await realpath(profileSkillRoot))

    const excludeContent = await readFile(
      path.join(projectPath, ".git", "info", "exclude"),
      "utf8",
    )
    expect(excludeContent).toContain(".codex/skills/harbor-*")
  })

  it("resolves gitdir files when updating local git excludes", async () => {
    const harborHomeDirectory = await createTempDir("harbor-skill-home-")
    const projectPath = await createTempDir("harbor-skill-project-")
    const actualGitDir = await createTempDir("harbor-skill-gitdir-")
    tempRoots.push(harborHomeDirectory, projectPath, actualGitDir)

    await mkdir(path.join(actualGitDir, "info"), { recursive: true })
    await writeFile(path.join(projectPath, ".git"), `gitdir: ${actualGitDir}\n`, "utf8")

    const profileSkillRoot = path.join(
      harborHomeDirectory,
      "skills",
      "profiles",
      "default",
      "review-diff",
    )
    await mkdir(profileSkillRoot, { recursive: true })

    const service = createProjectSkillBridgeService({
      harborHomeDirectory,
      projectRepository: {
        getProjectById: vi.fn(async () => buildProject(projectPath)),
      },
    })

    await service.ensureProjectSkillBridge({
      projectId: "project-1",
    })

    const excludeContent = await readFile(
      path.join(actualGitDir, "info", "exclude"),
      "utf8",
    )
    expect(excludeContent).toContain(".codex/skills/harbor-*")
  })

  it("reconciles bridge entries when the Harbor skill profile changes", async () => {
    const harborHomeDirectory = await createTempDir("harbor-skill-home-")
    const projectPath = await createTempDir("harbor-skill-project-")
    tempRoots.push(harborHomeDirectory, projectPath)

    await mkdir(path.join(projectPath, ".git", "info"), { recursive: true })
    await mkdir(
      path.join(
        harborHomeDirectory,
        "skills",
        "profiles",
        "default",
        "fix-tests",
      ),
      { recursive: true },
    )
    await mkdir(
      path.join(
        harborHomeDirectory,
        "skills",
        "profiles",
        "team-a",
        "review-diff",
      ),
      { recursive: true },
    )

    const service = createProjectSkillBridgeService({
      harborHomeDirectory,
      projectRepository: {
        getProjectById: vi.fn(async () => buildProject(projectPath)),
      },
    })

    await service.ensureProjectSkillBridge({
      projectId: "project-1",
      profile: "default",
    })
    const state = await service.ensureProjectSkillBridge({
      projectId: "project-1",
      profile: "team-a",
    })

    expect(state.linkedSkillNames).toEqual(["review-diff"])
    await expect(
      readlink(path.join(projectPath, ".codex", "skills", "harbor-fix-tests")),
    ).rejects.toThrow()
    expect(
      await readlink(
        path.join(projectPath, ".codex", "skills", "harbor-review-diff"),
      ),
    ).toBe(
      path.join(
        harborHomeDirectory,
        "projects",
        "project-1",
        "skills",
        "review-diff",
      ),
    )
  })
})
