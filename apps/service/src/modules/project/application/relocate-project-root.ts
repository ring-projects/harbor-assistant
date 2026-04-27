import { type Project, relocateProjectRoot } from "../domain/project"
import { createProjectError } from "../errors"
import type { ProjectPathPolicy } from "./project-path-policy"
import type { ProjectRepository } from "./project-repository"

export async function relocateProjectRootUseCase(
  repository: Pick<
    ProjectRepository,
    "findById" | "findByNormalizedPath" | "save"
  >,
  pathPolicy: ProjectPathPolicy,
  input: {
    projectId: string
    nextPath: string
    now?: Date
  },
): Promise<Project> {
  const project = await repository.findById(input.projectId)
  if (!project) {
    throw createProjectError().notFound()
  }

  const normalizedPath = await pathPolicy.canonicalizeProjectRoot(
    input.nextPath,
  )
  const existing = await repository.findByNormalizedPath(normalizedPath)
  if (existing && existing.id !== project.id) {
    throw createProjectError().duplicatePath()
  }

  const next = relocateProjectRoot(
    project,
    {
      normalizedPath,
      rootPath: normalizedPath,
    },
    input.now,
  )
  await repository.save(next)
  return next
}
