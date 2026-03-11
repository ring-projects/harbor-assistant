import { execFile } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import type { FastifyInstance } from "fastify"
import type { PrismaClient } from "@prisma/client"

import { createGitTestApp } from "../../../../test/helpers/git-test-app"
import {
  createTestDatabase,
  type TestDatabase,
} from "../../../../test/helpers/test-database"

const execFileAsync = promisify(execFile)

async function execGit(cwd: string, args: string[]) {
  await execFileAsync("git", args, {
    cwd,
    windowsHide: true,
  })
}

async function createTempDir() {
  return mkdtemp(path.join(tmpdir(), "harbor-git-route-test-"))
}

async function createGitProject() {
  const projectPath = await createTempDir()
  await execGit(projectPath, ["init"])
  await execGit(projectPath, ["config", "user.email", "harbor@example.com"])
  await execGit(projectPath, ["config", "user.name", "Harbor Test"])
  await writeFile(path.join(projectPath, "README.md"), "# Harbor\n", "utf8")
  await execGit(projectPath, ["add", "README.md"])
  await execGit(projectPath, ["commit", "-m", "initial commit"])

  const branchResult = await execFileAsync("git", ["branch", "--show-current"], {
    cwd: projectPath,
    windowsHide: true,
  })

  return {
    projectPath,
    currentBranch: branchResult.stdout.trim(),
  }
}

describe("git routes", () => {
  let database: TestDatabase
  let prisma: PrismaClient
  let app: FastifyInstance
  const tempDirs: string[] = []

  beforeAll(async () => {
    database = await createTestDatabase()
    prisma = database.prisma
    app = await createGitTestApp(prisma)
  })

  afterEach(async () => {
    await prisma.projectSetting.deleteMany()
    await prisma.project.deleteMany()

    await Promise.all(
      tempDirs.splice(0, tempDirs.length).map((dir) =>
        rm(dir, { recursive: true, force: true }),
      ),
    )
  })

  afterAll(async () => {
    await app.close()
    await database.cleanup()
  })

  it("returns repository summary for a git project", async () => {
    const gitProject = await createGitProject()
    tempDirs.push(gitProject.projectPath)

    const createProjectResponse = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        path: gitProject.projectPath,
        name: "Git Project",
      },
    })

    const projectId = (createProjectResponse.json() as {
      projects: Array<{ id: string }>
    }).projects[0]?.id

    const response = await app.inject({
      method: "GET",
      url: `/v1/projects/${projectId}/git`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      repository: {
        projectId,
        currentBranch: gitProject.currentBranch,
        detached: false,
        dirty: false,
      },
    })
  })

  it("creates and lists branches for a git project", async () => {
    const gitProject = await createGitProject()
    tempDirs.push(gitProject.projectPath)

    const createProjectResponse = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        path: gitProject.projectPath,
      },
    })

    const projectId = (createProjectResponse.json() as {
      projects: Array<{ id: string }>
    }).projects[0]?.id

    const createBranchResponse = await app.inject({
      method: "POST",
      url: `/v1/projects/${projectId}/git/branches`,
      payload: {
        branchName: "feature/test-git",
        checkout: false,
      },
    })

    expect(createBranchResponse.statusCode).toBe(200)
    expect(createBranchResponse.json()).toMatchObject({
      ok: true,
      repository: {
        currentBranch: gitProject.currentBranch,
      },
    })

    const listResponse = await app.inject({
      method: "GET",
      url: `/v1/projects/${projectId}/git/branches`,
    })

    expect(listResponse.statusCode).toBe(200)
    expect(listResponse.json()).toMatchObject({
      ok: true,
      projectId,
      currentBranch: gitProject.currentBranch,
      branches: expect.arrayContaining([
        { name: gitProject.currentBranch, current: true },
        { name: "feature/test-git", current: false },
      ]),
    })
  })

  it("checks out an existing branch", async () => {
    const gitProject = await createGitProject()
    tempDirs.push(gitProject.projectPath)

    await execGit(gitProject.projectPath, ["branch", "feature/checkout-me"])

    const createProjectResponse = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        path: gitProject.projectPath,
      },
    })

    const projectId = (createProjectResponse.json() as {
      projects: Array<{ id: string }>
    }).projects[0]?.id

    const response = await app.inject({
      method: "POST",
      url: `/v1/projects/${projectId}/git/checkout`,
      payload: {
        branchName: "feature/checkout-me",
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      repository: {
        projectId,
        currentBranch: "feature/checkout-me",
      },
    })
  })

  it("returns project-scoped git diff", async () => {
    const gitProject = await createGitProject()
    tempDirs.push(gitProject.projectPath)

    await writeFile(
      path.join(gitProject.projectPath, "README.md"),
      "# Harbor\n\nupdated\n",
      "utf8",
    )

    const createProjectResponse = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        path: gitProject.projectPath,
      },
    })

    const projectId = (createProjectResponse.json() as {
      projects: Array<{ id: string }>
    }).projects[0]?.id

    const response = await app.inject({
      method: "GET",
      url: `/v1/projects/${projectId}/git/diff`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      diff: {
        projectId,
        files: [
          expect.objectContaining({
            path: "README.md",
          }),
        ],
      },
    })
  })

  it("returns conflict when creating an existing branch", async () => {
    const gitProject = await createGitProject()
    tempDirs.push(gitProject.projectPath)

    await execGit(gitProject.projectPath, ["branch", "feature/existing"])

    const createProjectResponse = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        path: gitProject.projectPath,
      },
    })

    const projectId = (createProjectResponse.json() as {
      projects: Array<{ id: string }>
    }).projects[0]?.id

    const response = await app.inject({
      method: "POST",
      url: `/v1/projects/${projectId}/git/branches`,
      payload: {
        branchName: "feature/existing",
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "GIT_BRANCH_ALREADY_EXISTS",
      },
    })
  })
})
