import { NextResponse } from "next/server"

import { ERROR_CODES } from "@/constants"
import type {
  ProjectApiError,
  ProjectApiResult,
} from "@/services/project/contracts"
import { ProjectRepositoryError } from "@/services/project/project.repository"
import type { ProjectErrorCode } from "@/services/project/types"

export function statusFromProjectErrorCode(code: ProjectErrorCode) {
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

export function mapProjectRouteError(
  error: unknown,
  fallbackMessage: string,
): {
  status: number
  payload: ProjectApiError
} {
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

export function projectJson(body: ProjectApiResult, status = 200) {
  return NextResponse.json(body, { status })
}
