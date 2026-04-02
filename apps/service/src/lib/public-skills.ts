import { cp, mkdir, readdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

function getBundledPublicSkillsDirectory() {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../public-skills",
  )
}

export async function ensureHarborPublicSkills(args: {
  publicSkillsRootDirectory: string
}) {
  const sourceRoot = getBundledPublicSkillsDirectory()
  const targetRoot = args.publicSkillsRootDirectory

  await mkdir(targetRoot, { recursive: true })

  const entries = await readdir(sourceRoot, {
    withFileTypes: true,
  }).catch(() => [])

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    await cp(
      path.join(sourceRoot, entry.name),
      path.join(targetRoot, entry.name),
      {
        recursive: true,
        force: true,
      },
    )
  }
}
