import type { ProjectRepository } from "../../project"
import {
  bootstrapProjectSandboxTemplate,
  type SandboxProvisioningPort,
  type SandboxRegistry,
} from "../../sandbox"
import type { BackgroundJobRepository } from "./background-job-repository"
import type { BackgroundJobRecord } from "../domain/background-job"

export const PROJECT_SANDBOX_TEMPLATE_BOOTSTRAP_JOB_TYPE =
  "project_sandbox_template_bootstrap" as const

export function buildProjectSandboxTemplateBootstrapDedupeKey(
  projectId: string,
) {
  return `project-sandbox-template:${projectId.trim()}`
}

export async function enqueueProjectSandboxTemplateBootstrapJobUseCase(
  deps: {
    repository: BackgroundJobRepository
  },
  input: {
    projectId: string
    runAfter?: Date
  },
) {
  return deps.repository.enqueue({
    type: PROJECT_SANDBOX_TEMPLATE_BOOTSTRAP_JOB_TYPE,
    dedupeKey: buildProjectSandboxTemplateBootstrapDedupeKey(input.projectId),
    payload: {
      projectId: input.projectId,
    },
    runAfter: input.runAfter,
    maxAttempts: 3,
  })
}

export async function runProjectSandboxTemplateBootstrapJobUseCase(
  deps: {
    projectRepository: Pick<ProjectRepository, "findById">
    provider: SandboxProvisioningPort
    registry: SandboxRegistry
    logger?: {
      info?: (...args: unknown[]) => void
      warn?: (...args: unknown[]) => void
    }
  },
  job: BackgroundJobRecord,
) {
  const projectId =
    typeof job.payload.projectId === "string"
      ? job.payload.projectId.trim()
      : ""
  if (!projectId) {
    throw new Error("projectId is required")
  }

  const project = await deps.projectRepository.findById(projectId)
  if (!project) {
    deps.logger?.warn?.(
      `[harbor:jobs] project sandbox template bootstrap skipped because project was not found project=${projectId}`,
    )
    return
  }

  await bootstrapProjectSandboxTemplate(
    {
      provider: deps.provider,
      registry: deps.registry,
      logger: deps.logger,
    },
    {
      project,
    },
  )
}
