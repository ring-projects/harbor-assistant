import { z } from "zod"

import { ERROR_CODES } from "@/constants"
import { listDirectory } from "@/services/filesystem/filesystem.service"
import { FileSystemServiceError } from "@/services/filesystem/types"

export const runtime = "nodejs"

const ListDirectoryInputSchema = z.object({
  path: z.string().optional(),
  cursor: z.string().nullable().optional(),
  limit: z.number().int().positive().optional(),
  includeHidden: z.boolean().optional(),
  directoriesOnly: z.boolean().optional(),
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

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json(
      {
        ok: false,
        error: {
          code: ERROR_CODES.INVALID_REQUEST_BODY,
          message: "Request body must be valid JSON.",
        },
      },
      { status: 400 },
    )
  }

  const parsed = ListDirectoryInputSchema.safeParse(payload)
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: {
          code: ERROR_CODES.INVALID_REQUEST_BODY,
          message:
            "Expected payload: { path?: string; cursor?: string | null; limit?: number; includeHidden?: boolean; directoriesOnly?: boolean }.",
        },
      },
      { status: 400 },
    )
  }

  try {
    const result = await listDirectory(parsed.data)
    return Response.json({
      ok: true,
      ...result,
    })
  } catch (error) {
    const mapped = mapFileSystemError(error)
    return Response.json(
      {
        ok: false,
        error: {
          code: mapped.code,
          message: mapped.message,
        },
      },
      {
        status: mapped.status,
      },
    )
  }
}
