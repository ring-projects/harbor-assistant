import {
  createProject,
  type CreateProjectInput,
} from "../domain/project"
import { createProjectError } from "../errors"
import type { ProjectRepository } from "./project-repository"
import type { ProjectPathPolicy } from "./project-path-policy"

export type CreateProjectCommand =
  Omit<CreateProjectInput, "normalizedPath" | "rootPath"> & {
    rootPath: string
  }

export async function createProjectUseCase(
  repository: ProjectRepository,
  pathPolicy: ProjectPathPolicy,
  input: CreateProjectCommand,
){
  const canonicalPath = await pathPolicy.canonicalizeProjectRoot(input.rootPath)
  const project = createProject({
    ...input,
    normalizedPath: canonicalPath,
    rootPath: canonicalPath,
  })
  const existing = await repository.findByNormalizedPath(project.normalizedPath)
  if (existing) {
    throw createProjectError().duplicatePath()
  }

  await repository.save(project)
  return project
}
