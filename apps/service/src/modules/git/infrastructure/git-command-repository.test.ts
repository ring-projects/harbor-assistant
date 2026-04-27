import { execFile } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"

import { afterEach, describe, expect, it } from "vitest"

import { getDiffUseCase } from "../application/get-diff"
import { getRepositorySummaryUseCase } from "../application/get-repository-summary"
import { listBranchesUseCase } from "../application/list-branches"
import { checkoutBranchUseCase } from "../application/checkout-branch"
import { createBranchUseCase } from "../application/create-branch"
import { createGitCommandRepository } from "./git-command-repository"

const execFileAsync = promisify(execFile)

async function runGit(cwd: string, args: string[]) {
  await execFileAsync("git", args, {
    cwd,
    windowsHide: true,
  })
}

async function createTempRepository() {
  const root = await mkdtemp(path.join(tmpdir(), "harbor-git-module-"))

  await runGit(root, ["init", "-b", "main"])
  await runGit(root, ["config", "user.name", "Harbor Test"])
  await runGit(root, ["config", "user.email", "harbor@example.com"])

  await writeFile(path.join(root, "README.md"), "hello\n", "utf8")
  await runGit(root, ["add", "README.md"])
  await runGit(root, ["commit", "-m", "initial commit"])
  await runGit(root, ["checkout", "-b", "feature/refactor"])

  await writeFile(path.join(root, "README.md"), "hello world\n", "utf8")

  return root
}

async function createCleanRepository() {
  const root = await mkdtemp(path.join(tmpdir(), "harbor-git-module-"))

  await runGit(root, ["init", "-b", "main"])
  await runGit(root, ["config", "user.name", "Harbor Test"])
  await runGit(root, ["config", "user.email", "harbor@example.com"])

  await writeFile(path.join(root, "README.md"), "hello\n", "utf8")
  await runGit(root, ["add", "README.md"])
  await runGit(root, ["commit", "-m", "initial commit"])

  return root
}

describe("createGitCommandRepository", () => {
  const roots: string[] = []

  afterEach(async () => {
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    )
  })

  it("reads repository summary, branches and diff from a real repository", async () => {
    const root = await createTempRepository()
    roots.push(root)

    const repository = createGitCommandRepository()

    await expect(
      getRepositorySummaryUseCase(repository, { path: root }),
    ).resolves.toMatchObject({
      path: root,
      repositoryRoot: expect.stringContaining(path.basename(root)),
      currentBranch: "feature/refactor",
      detached: false,
      dirty: true,
    })

    await expect(
      listBranchesUseCase(repository, { path: root }),
    ).resolves.toMatchObject({
      path: root,
      currentBranch: "feature/refactor",
      branches: expect.arrayContaining([
        { name: "main", current: false },
        { name: "feature/refactor", current: true },
      ]),
    })

    await expect(
      getDiffUseCase(repository, { path: root }),
    ).resolves.toMatchObject({
      path: root,
      files: [
        expect.objectContaining({
          path: "README.md",
          status: "modified",
        }),
      ],
    })
  })

  it("creates and checks out branches in a real repository", async () => {
    const root = await createCleanRepository()
    roots.push(root)

    const repository = createGitCommandRepository()

    await expect(
      createBranchUseCase(repository, {
        path: root,
        branchName: "feature/refactor",
        checkout: true,
      }),
    ).resolves.toMatchObject({
      path: root,
      currentBranch: "feature/refactor",
      branches: expect.arrayContaining([
        { name: "main", current: false },
        { name: "feature/refactor", current: true },
      ]),
    })

    await expect(
      checkoutBranchUseCase(repository, {
        path: root,
        branchName: "main",
      }),
    ).resolves.toMatchObject({
      path: root,
      currentBranch: "main",
      detached: false,
      dirty: false,
    })
  })
})
