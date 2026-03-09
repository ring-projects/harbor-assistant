export type AppErrorOptions = {
  details?: unknown
  headers?: Record<string, string>
  cause?: unknown
}

export class AppError extends Error {
  readonly code: string
  readonly statusCode: number
  readonly details?: unknown
  readonly headers?: Record<string, string>

  constructor(
    code: string,
    statusCode: number,
    message: string,
    options?: AppErrorOptions,
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined)

    this.name = new.target.name
    this.code = code
    this.statusCode = statusCode
    this.details = options?.details
    this.headers = options?.headers

    Error.captureStackTrace?.(this, this.constructor)
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
