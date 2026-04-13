import {
  createProject,
  type GitProjectSource,
  type RootPathProjectSource,
} from "../domain/project"
import { createProjectError } from "../errors"
import type { ProjectRepository } from "./project-repository"
import type { ProjectPathPolicy } from "./project-path-policy"

export type CreateProjectCommand = {
  id: string
  name: string
  ownerUserId?: string | null
  workspaceId?: string | null
  description?: string | null
  now?: Date
  source:
    | {
        type: "rootPath"
        rootPath: string
      }
    | {
        type: "git"
        repositoryUrl: string
        branch?: string | null
      }
}

export async function createProjectUseCase(
  repository: ProjectRepository,
  pathPolicy: ProjectPathPolicy,
  input: CreateProjectCommand,
){
  let source: RootPathProjectSource | GitProjectSource

  if (input.source.type === "rootPath") {
    const canonicalPath = await pathPolicy.canonicalizeProjectRoot(
      input.source.rootPath,
    )
    const existing = await repository.findByNormalizedPath(canonicalPath)
    if (existing) {
      throw createProjectError().duplicatePath()
    }

    source = {
      type: "rootPath",
      rootPath: canonicalPath,
      normalizedPath: canonicalPath,
    }
  } else {
    source = {
      type: "git",
      repositoryUrl: input.source.repositoryUrl,
      branch: input.source.branch ?? null,
    }
  }

  const project =
    source.type === "rootPath"
      ? createProject({
          ...input,
          source,
        })
      : createProject({
          ...input,
          source,
        })

  await repository.save(project)
  return project
}
