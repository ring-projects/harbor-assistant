import {
  relocateProjectRoot,
  type Project,
  type UpdateProjectProfileInput,
  updateProjectProfile,
} from "../domain/project"
import { createProjectError } from "../errors"
import type { ProjectPathPolicy } from "./project-path-policy"
import type { ProjectRepository } from "./project-repository"

export type UpdateProjectCommand = {
  projectId: string
  changes: UpdateProjectProfileInput & {
    rootPath?: string
  }
  now?: Date
}

export async function updateProjectUseCase(
  repository: Pick<
    ProjectRepository,
    "findById" | "findByNormalizedPath" | "findBySlug" | "save"
  >,
  pathPolicy: ProjectPathPolicy,
  input: UpdateProjectCommand,
): Promise<Project> {
  const project = await repository.findById(input.projectId)
  if (!project) {
    throw createProjectError().notFound()
  }

  const now = input.now ?? new Date()
  let next = project

  if (
    input.changes.name !== undefined ||
    input.changes.description !== undefined
  ) {
    next = updateProjectProfile(
      next,
      {
        name: input.changes.name,
        description: input.changes.description,
      },
      now,
    )

    const duplicateSlug = await repository.findBySlug(next.slug)
    if (duplicateSlug && duplicateSlug.id !== next.id) {
      throw createProjectError().duplicateSlug()
    }
  }

  if (input.changes.rootPath !== undefined) {
    if (next.source.type !== "rootPath") {
      throw createProjectError().invalidState(
        "only rootPath projects can update their root path",
      )
    }

    const normalizedPath = await pathPolicy.canonicalizeProjectRoot(
      input.changes.rootPath,
    )
    const duplicatePath = await repository.findByNormalizedPath(normalizedPath)
    if (duplicatePath && duplicatePath.id !== next.id) {
      throw createProjectError().duplicatePath()
    }

    next = relocateProjectRoot(
      next,
      {
        normalizedPath,
        rootPath: normalizedPath,
      },
      now,
    )
  }

  if (next === project) {
    return project
  }

  await repository.save(next)
  return next
}
