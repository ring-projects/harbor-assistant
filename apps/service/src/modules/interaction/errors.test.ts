import { AppError } from "../../lib/errors/app-error"
import {
  INTERACTION_ERROR_CODES,
  createInteractionError,
  isInteractionError,
  toInteractionMessageError,
} from "./errors"

import { describe, expect, it } from "vitest"

describe("interaction errors", () => {
  it("creates structured interaction errors", () => {
    const error = createInteractionError().deliveryFailed("socket emit failed")

    expect(isInteractionError(error)).toBe(true)
    expect(error.code).toBe(INTERACTION_ERROR_CODES.DELIVERY_FAILED)
    expect(error.message).toBe("socket emit failed")
  })

  it("maps unknown errors to interaction message error payload", () => {
    const error = new AppError("PROJECT_NOT_FOUND", 404, "Project not found.")

    expect(toInteractionMessageError(error)).toEqual({
      code: "PROJECT_NOT_FOUND",
      message: "Project not found.",
    })
  })
})
