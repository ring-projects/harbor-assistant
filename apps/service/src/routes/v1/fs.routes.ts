import type { FastifyInstance } from "fastify"
import { z } from "zod"

import { ERROR_CODES } from "../../constants/errors"
import { listDirectory } from "../../modules/filesystem/filesystem.service"
import { FileSystemServiceError } from "../../modules/filesystem/types"

const ListDirectoryInputSchema = z.object({
  path: z.string().optional(),
  cursor: z.string().nullable().optional(),
  limit: z.number().int().positive().optional(),
  includeHidden: z.boolean().optional(),
})

function mapFileSystemError(error: unknown) {
  if (error instanceof FileSystemServiceError) {
    if (
      error.code === ERROR_CODES.INVALID_PATH ||
      error.code === ERROR_CODES.INVALID_CURSOR ||
      error.code === ERROR_CODES.NOT_A_DIRECTORY
    ) {
      return {
        status: 400,
        code: error.code,
        message: error.message,
      }
    }

    if (
      error.code === ERROR_CODES.PATH_NOT_FOUND ||
      error.code === ERROR_CODES.PATH_OUTSIDE_ALLOWED_ROOT
    ) {
      return {
        status: 404,
        code: error.code,
        message: error.message,
      }
    }

    if (error.code === ERROR_CODES.PERMISSION_DENIED) {
      return {
        status: 403,
        code: error.code,
        message: error.message,
      }
    }

    return {
      status: 500,
      code: error.code,
      message: error.message,
    }
  }

  return {
    status: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: "Failed to list directory.",
  }
}

export async function registerFileSystemRoutes(app: FastifyInstance) {
  app.post("/fs/list", async (request, reply) => {
    const parsed = ListDirectoryInputSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: ERROR_CODES.INVALID_REQUEST_BODY,
          message:
            "Expected payload: { path?: string; cursor?: string | null; limit?: number; includeHidden?: boolean }.",
        },
      })
    }

    try {
      const result = await listDirectory(parsed.data)
      return reply.send({
        ok: true,
        ...result,
      })
    } catch (error) {
      const mapped = mapFileSystemError(error)
      return reply.status(mapped.status).send({
        ok: false,
        error: {
          code: mapped.code,
          message: mapped.message,
        },
      })
    }
  })
}
