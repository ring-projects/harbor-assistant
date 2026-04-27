export const ORCHESTRATION_ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  NOT_FOUND: "NOT_FOUND",
  INVALID_STATE: "INVALID_STATE",
} as const

export type OrchestrationErrorCode =
  (typeof ORCHESTRATION_ERROR_CODES)[keyof typeof ORCHESTRATION_ERROR_CODES]

export class OrchestrationError extends Error {
  readonly code: OrchestrationErrorCode

  constructor(code: OrchestrationErrorCode, message: string) {
    super(message)
    this.name = "OrchestrationError"
    this.code = code
  }
}

export function createOrchestrationError() {
  return {
    invalidInput(message: string) {
      return new OrchestrationError(
        ORCHESTRATION_ERROR_CODES.INVALID_INPUT,
        message,
      )
    },
    notFound(message = "orchestration not found") {
      return new OrchestrationError(
        ORCHESTRATION_ERROR_CODES.NOT_FOUND,
        message,
      )
    },
    invalidState(message: string) {
      return new OrchestrationError(
        ORCHESTRATION_ERROR_CODES.INVALID_STATE,
        message,
      )
    },
  }
}

export function isOrchestrationError(
  error: unknown,
): error is OrchestrationError {
  return error instanceof OrchestrationError
}
