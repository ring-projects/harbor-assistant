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
    const harborHomeDirectory = await mkdtemp(
      path.join(tmpdir(), "harbor-public-skills-"),
    )
    tempDirs.push(harborHomeDirectory)

    await ensureHarborPublicSkills({
      harborHomeDirectory,
    })

    const skillRoot = path.join(
      harborHomeDirectory,
      "skills",
      "profiles",
      "default",
      "task-title",
    )

    await expect(access(path.join(skillRoot, "SKILL.md"))).resolves.toBeNull()
    await expect(
      access(path.join(skillRoot, "scripts", "set-task-title.mjs")),
    ).resolves.toBeNull()

    const skillContent = await readFile(path.join(skillRoot, "SKILL.md"), "utf8")
    expect(skillContent).toContain("harbor-task-title")
  })
})
