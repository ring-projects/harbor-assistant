import { access, mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { ensureHarborPublicSkills } from "./public-skills"

describe("ensureHarborPublicSkills", () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0, tempDirs.length).map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    )
  })

  it("copies bundled Harbor public skills into the default Harbor profile", async () => {
    const runtimeRootDirectory = await mkdtemp(
      path.join(tmpdir(), "harbor-public-skills-"),
    )
    tempDirs.push(runtimeRootDirectory)
    const publicSkillsRootDirectory = path.join(
      runtimeRootDirectory,
      "skills",
      "profiles",
      "default",
    )

    await ensureHarborPublicSkills({
      publicSkillsRootDirectory,
    })

    const skillRoot = path.join(publicSkillsRootDirectory, "task-title")

    await expect(access(path.join(skillRoot, "SKILL.md"))).resolves.toBeUndefined()
    await expect(
      access(path.join(skillRoot, "scripts", "set-task-title.mjs")),
    ).resolves.toBeUndefined()

    const skillContent = await readFile(path.join(skillRoot, "SKILL.md"), "utf8")
    expect(skillContent).toContain("harbor-task-title")
  })
})
