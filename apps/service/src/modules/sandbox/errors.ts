export const SANDBOX_ERROR_CODES = {
  NOT_FOUND: "sandbox/not-found",
  PROVIDER_ERROR: "sandbox/provider-error",
  INVALID_INPUT: "sandbox/invalid-input",
} as const

export class SandboxError extends Error {
  constructor(
    readonly code: (typeof SANDBOX_ERROR_CODES)[keyof typeof SANDBOX_ERROR_CODES],
    message: string,
  ) {
    super(message)
    this.name = "SandboxError"
  }
}

export function createSandboxError() {
  return {
    notFound(message = "Sandbox was not found.") {
      return new SandboxError(SANDBOX_ERROR_CODES.NOT_FOUND, message)
    },
    providerError(message = "Sandbox provider operation failed.") {
      return new SandboxError(SANDBOX_ERROR_CODES.PROVIDER_ERROR, message)
    },
    invalidInput(message = "Sandbox input is invalid.") {
      return new SandboxError(SANDBOX_ERROR_CODES.INVALID_INPUT, message)
    },
  }
}

export function isSandboxError(value: unknown): value is SandboxError {
  return value instanceof SandboxError
}
