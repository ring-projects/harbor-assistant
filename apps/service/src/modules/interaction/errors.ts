import { toAppError } from "../../lib/errors/error-response"

export const INTERACTION_ERROR_CODES = {
  INVALID_TOPIC: "INTERACTION_INVALID_TOPIC",
  INVALID_CURSOR: "INTERACTION_INVALID_CURSOR",
  SUBSCRIPTION_NOT_FOUND: "INTERACTION_SUBSCRIPTION_NOT_FOUND",
  DELIVERY_FAILED: "INTERACTION_DELIVERY_FAILED",
  CHANNEL_NOT_SUPPORTED: "INTERACTION_CHANNEL_NOT_SUPPORTED",
} as const

export type InteractionErrorCode =
  (typeof INTERACTION_ERROR_CODES)[keyof typeof INTERACTION_ERROR_CODES]

export class InteractionError extends Error {
  readonly code: InteractionErrorCode

  constructor(code: InteractionErrorCode, message: string) {
    super(message)
    this.name = "InteractionError"
    this.code = code
  }
}

export function createInteractionError() {
  return {
    invalidTopic(message = "Interaction topic is invalid.") {
      return new InteractionError(INTERACTION_ERROR_CODES.INVALID_TOPIC, message)
    },
    invalidCursor(message = "Interaction cursor is invalid.") {
      return new InteractionError(INTERACTION_ERROR_CODES.INVALID_CURSOR, message)
    },
    subscriptionNotFound(message = "Interaction subscription was not found.") {
      return new InteractionError(
        INTERACTION_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
        message,
      )
    },
    deliveryFailed(message = "Failed to deliver interaction message.") {
      return new InteractionError(INTERACTION_ERROR_CODES.DELIVERY_FAILED, message)
    },
    channelNotSupported(message = "Interaction channel is not supported.") {
      return new InteractionError(
        INTERACTION_ERROR_CODES.CHANNEL_NOT_SUPPORTED,
        message,
      )
    },
  }
}

export function isInteractionError(error: unknown): error is InteractionError {
  return error instanceof InteractionError
}

export type InteractionMessageError = {
  code: string
  message: string
}

export function toInteractionMessageError(
  error: unknown,
): InteractionMessageError {
  const appError = toAppError(error)

  return {
    code: appError.code,
    message: appError.message,
  }
}
