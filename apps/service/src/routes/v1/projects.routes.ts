import type { FastifyInstance } from "fastify"
import { z } from "zod"

import { ERROR_CODES } from "../../constants/errors"
import {
  ProjectRepositoryError,
  addProject,
  deleteProject,
  listProjects,
  updateProject,
} from "../../modules/project/project.repository"
import type { ProjectErrorCode } from "../../modules/project/errors"

const AddProjectInputSchema = z.object({
  path: z.string(),
  name: z.string().optional(),
})

const UpdateProjectInputSchema = z
  .object({
    path: z.string().optional(),
    name: z.string().optional(),
  })
  .refine(
    (value) => typeof value.path === "string" || typeof value.name === "string",
    {
      message: "At least one field (path or name) must be provided.",
    },
  )

function statusFromProjectErrorCode(code: ProjectErrorCode) {
  if (code === "DUPLICATE_PATH") {
    return 409
  }

  if (
    code === "INVALID_PATH" ||
    code === "PATH_NOT_FOUND" ||
    code === "NOT_A_DIRECTORY" ||
    code === "INVALID_PROJECT_ID"
  ) {
    return 400
  }

  return 500
}

function mapProjectRouteError(error: unknown, fallbackMessage: string) {
  if (error instanceof ProjectRepositoryError) {
    return {
      status: statusFromProjectErrorCode(error.code),
      payload: {
        code: error.code,
        message: error.message,
      },
    }
  }

  return {
    status: 500,
    payload: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: fallbackMessage,
    },
  }
}

export async function registerProjectRoutes(app: FastifyInstance) {
  app.get("/projects", async (_request, reply) => {
    try {
      const projects = await listProjects()
      return reply.send({
        ok: true,
        projects,
      })
    } catch (error) {
      const mapped = mapProjectRouteError(error, "Failed to fetch projects.")
      return reply.status(mapped.status).send({
        ok: false,
        projects: [],
        error: mapped.payload,
      })
    }
  })

  app.post("/projects", async (request, reply) => {
    const parsed = AddProjectInputSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        projects: [],
        error: {
          code: ERROR_CODES.INVALID_REQUEST_BODY,
          message: "Expected payload: { path: string; name?: string }.",
        },
      })
    }

    try {
      await addProject(parsed.data)
      const projects = await listProjects()
      return reply.send({
        ok: true,
        projects,
      })
    } catch (error) {
      const projects = await listProjects().catch(() => [])
      const mapped = mapProjectRouteError(error, "Failed to add project.")
      return reply.status(mapped.status).send({
        ok: false,
        projects,
        error: mapped.payload,
      })
    }
  })

  app.put("/projects/:id", async (request, reply) => {
    const id = String((request.params as { id: string }).id ?? "")
    const parsed = UpdateProjectInputSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        projects: [],
        error: {
          code: ERROR_CODES.INVALID_REQUEST_BODY,
          message: "Expected payload: { path?: string; name?: string }.",
        },
      })
    }

    try {
      const updated = await updateProject({
        id,
        ...parsed.data,
      })
      const projects = await listProjects()
      if (!updated) {
        return reply.status(404).send({
          ok: false,
          projects,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: `Project not found: ${id}`,
          },
        })
      }

      return reply.send({
        ok: true,
        projects,
      })
    } catch (error) {
      const projects = await listProjects().catch(() => [])
      const mapped = mapProjectRouteError(error, "Failed to update project.")
      return reply.status(mapped.status).send({
        ok: false,
        projects,
        error: mapped.payload,
      })
    }
  })

  app.delete("/projects/:id", async (request, reply) => {
    const id = String((request.params as { id: string }).id ?? "")

    try {
      const deleted = await deleteProject(id)
      const projects = await listProjects()
      if (!deleted) {
        return reply.status(404).send({
          ok: false,
          projects,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: `Project not found: ${id}`,
          },
        })
      }

      return reply.send({
        ok: true,
        projects,
      })
    } catch (error) {
      const projects = await listProjects().catch(() => [])
      const mapped = mapProjectRouteError(error, "Failed to delete project.")
      return reply.status(mapped.status).send({
        ok: false,
        projects,
        error: mapped.payload,
      })
    }
  })
}
