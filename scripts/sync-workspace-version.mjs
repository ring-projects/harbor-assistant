import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)

const packageJsonPaths = [
  "package.json",
  "apps/service/package.json",
  "apps/web/package.json",
  "packages/harbor-events/package.json",
]

async function readPackageJson(relativePath) {
  const absolutePath = path.join(repositoryRoot, relativePath)
  const content = await readFile(absolutePath, "utf8")
  return {
    absolutePath,
    relativePath,
    json: JSON.parse(content),
  }
}

async function main() {
  const packages = await Promise.all(packageJsonPaths.map(readPackageJson))
  const servicePackage = packages.find(
    (entry) => entry.relativePath === "apps/service/package.json",
  )

  if (!servicePackage?.json.version) {
    throw new Error("apps/service/package.json is missing a version field")
  }

  const targetVersion = servicePackage.json.version
  const workspacePackages = packages.filter(
    (entry) => entry.relativePath !== "package.json",
  )
  const mismatchedWorkspacePackage = workspacePackages.find(
    (entry) => entry.json.version !== targetVersion,
  )

  if (mismatchedWorkspacePackage) {
    throw new Error(
      `Expected lockstep workspace versions after Changesets, but found ${mismatchedWorkspacePackage.relativePath} at ${mismatchedWorkspacePackage.json.version} instead of ${targetVersion}.`,
    )
  }

  const rootPackage = packages.find(
    (entry) => entry.relativePath === "package.json",
  )
  if (!rootPackage) {
    throw new Error("package.json was not found")
  }

  if (rootPackage.json.version === targetVersion) {
    return
  }

  rootPackage.json.version = targetVersion
  await writeFile(
    rootPackage.absolutePath,
    `${JSON.stringify(rootPackage.json, null, 2)}\n`,
    "utf8",
  )
}

main().catch((error) => {
  console.error("[sync-workspace-version] failed:", error)
  process.exitCode = 1
})
