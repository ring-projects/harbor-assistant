import { NextResponse } from "next/server"

import { ERROR_CODES } from "@/constants"
import type { TaskApiError, TaskApiResult } from "@/services/tasks/contracts"
import { TaskRepositoryError } from "@/services/tasks/task.repository"
import { TaskServiceError } from "@/services/tasks/task.service"

function statusFromTaskErrorCode(code: string) {
  if (
    code === ERROR_CODES.INVALID_PROJECT_ID ||
    code === ERROR_CODES.INVALID_PROMPT ||
    code === ERROR_CODES.INVALID_REQUEST_BODY ||
    code === ERROR_CODES.INVALID_TASK_ID ||
    code === ERROR_CODES.UNSUPPORTED_EXECUTOR
  ) {
    return 400
  }

  if (
    code === ERROR_CODES.PROJECT_NOT_FOUND ||
    code === ERROR_CODES.TASK_NOT_FOUND ||
    code === ERROR_CODES.NOT_FOUND
  ) {
    return 404
  }

  if (code === ERROR_CODES.INVALID_TASK_RETRY_STATE) {
    return 409
  }

  return 500
}

export function mapTaskRouteError(
  error: unknown,
  fallbackMessage: string,
): {
  status: number
  payload: TaskApiError
} {
  if (error instanceof TaskServiceError) {
    return {
      status: error.status,
      payload: {
        code: error.code,
        message: error.message,
      },
    }
  }

  if (error instanceof TaskRepositoryError) {
    return {
      status: statusFromTaskErrorCode(error.code),
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

export function taskJson(body: TaskApiResult, status = 200) {
  return NextResponse.json(body, { status })
}
