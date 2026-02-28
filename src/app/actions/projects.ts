"use server"

import {
  addProject,
  deleteProject,
  listProjects,
  ProjectRepositoryError,
} from "@/services/project/project.repository"
import type { Project } from "@/services/project/types"

type ProjectActionError = {
  code: string
  message: string
}

export type ProjectActionResult = {
  ok: boolean
  projects: Project[]
  error?: ProjectActionError
}

function mapError(error: unknown): ProjectActionError {
  if (error instanceof ProjectRepositoryError) {
    return {
      code: error.code,
      message: error.message,
    }
  }

  return {
    code: "INTERNAL_ERROR",
    message: "Unexpected error occurred while updating projects.",
  }
}

export async function addProjectAction(input: {
  path: string
  name?: string
}): Promise<ProjectActionResult> {
  try {
    await addProject(input)
    const projects = await listProjects()
    return {
      ok: true,
      projects,
    }
  } catch (error) {
    const projects = await listProjects().catch(() => [])
    return {
      ok: false,
      projects,
      error: mapError(error),
    }
  }
}

export async function listProjectsAction(): Promise<ProjectActionResult> {
  try {
    const projects = await listProjects()
    return {
      ok: true,
      projects,
    }
  } catch (error) {
    return {
      ok: false,
      projects: [],
      error: mapError(error),
    }
  }
}

export async function deleteProjectAction(input: {
  id: string
}): Promise<ProjectActionResult> {
  try {
    const deleted = await deleteProject(input.id)
    if (!deleted) {
      const projects = await listProjects()
      return {
        ok: false,
        projects,
        error: {
          code: "NOT_FOUND",
          message: `Project not found: ${input.id}`,
        },
      }
    }

    const projects = await listProjects()
    return {
      ok: true,
      projects,
    }
  } catch (error) {
    const projects = await listProjects().catch(() => [])
    return {
      ok: false,
      projects,
      error: mapError(error),
    }
  }
}
