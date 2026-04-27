import { access } from "node:fs/promises"
import path from "node:path"

import type { Project } from "../../project/domain/project"
import type { SandboxSource } from "../domain/sandbox"
import type { SandboxSnapshotRecord } from "../domain/sandbox-snapshot"
import { captureSandboxSnapshotUseCase } from "./capture-sandbox-snapshot"
import { provisionSandboxUseCase } from "./provision-sandbox"
import type { SandboxProvisioningPort } from "./sandbox-provider"
import type { SandboxRegistry } from "./sandbox-registry"
import { terminateSandboxUseCase } from "./terminate-sandbox"

const PROJECT_TEMPLATE_LABEL = "project-bootstrap"

async function pathExists(targetPath: string) {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

export async function resolveProjectSandboxSource(
  project: Project,
): Promise<SandboxSource | null> {
  if (project.rootPath?.trim()) {
    const rootPath = project.rootPath.trim()
    if (!(await pathExists(path.join(rootPath, ".git")))) {
      return null
    }

    return {
      type: "directory",
      path: rootPath,
    }
  }

  if (project.source.type === "git") {
    return {
      type: "git",
      repositoryUrl: project.source.repositoryUrl,
      ref: project.source.branch,
    }
  }

  return null
}

export async function findLatestProjectSandboxTemplateSnapshot(
  deps: {
    registry: SandboxRegistry
  },
  input: {
    projectId: string
  },
): Promise<{
  snapshot: SandboxSnapshotRecord
  sandboxId: string
} | null> {
  const sandboxes = await deps.registry.listSandboxesByProject(input.projectId)
  const templateSandboxes = sandboxes.filter(
    (sandbox) =>
      sandbox.metadata.purpose === "task-prepare" &&
      sandbox.metadata.labels.template === PROJECT_TEMPLATE_LABEL,
  )

  let latest: {
    snapshot: SandboxSnapshotRecord
    sandboxId: string
  } | null = null

  for (const sandbox of templateSandboxes) {
    const [snapshot] = await deps.registry.listSnapshotsBySandbox(sandbox.id)
    if (!snapshot) {
      continue
    }

    if (!latest || snapshot.createdAt > latest.snapshot.createdAt) {
      latest = {
        snapshot,
        sandboxId: sandbox.id,
      }
    }
  }

  return latest
}

export async function bootstrapProjectSandboxTemplate(
  deps: {
    provider: SandboxProvisioningPort
    registry: SandboxRegistry
    logger?: {
      info?: (...args: unknown[]) => void
      warn?: (...args: unknown[]) => void
    }
  },
  input: {
    project: Project
    force?: boolean
  },
) {
  const source = await resolveProjectSandboxSource(input.project)
  if (!source) {
    deps.logger?.info?.(
      `[harbor:sandbox] skipped project template bootstrap project=${input.project.id} source=unsupported`,
    )
    return null
  }

  if (!input.force) {
    const existing = await findLatestProjectSandboxTemplateSnapshot(deps, {
      projectId: input.project.id,
    })
    if (existing) {
      deps.logger?.info?.(
        `[harbor:sandbox] project template already ready project=${input.project.id} snapshot=${existing.snapshot.id}`,
      )
      return existing.snapshot
    }
  }

  let sandboxId: string | null = null

  try {
    const sandbox = await provisionSandboxUseCase(
      {
        provider: deps.provider,
        registry: deps.registry,
      },
      {
        mode: "safe",
        source,
        projectId: input.project.id,
        purpose: "task-prepare",
        labels: {
          template: PROJECT_TEMPLATE_LABEL,
        },
      },
    )
    sandboxId = sandbox.id

    const snapshot = await captureSandboxSnapshotUseCase(
      {
        provider: deps.provider,
        registry: deps.registry,
      },
      {
        sandboxId,
      },
    )

    deps.logger?.info?.(
      `[harbor:sandbox] project template ready project=${input.project.id} snapshot=${snapshot.id}`,
    )

    return snapshot
  } finally {
    if (sandboxId) {
      try {
        await terminateSandboxUseCase(
          {
            provider: deps.provider,
            registry: deps.registry,
          },
          {
            sandboxId,
          },
        )
      } catch (error) {
        deps.logger?.warn?.(
          {
            projectId: input.project.id,
            sandboxId,
            error,
          },
          "Failed to terminate project template bootstrap sandbox",
        )
      }
    }
  }
}
