import fp from "fastify-plugin"

import { ERROR_CODES } from "../constants/errors"
import { AppError, isAppError } from "../lib/errors/app-error"
import { toAppError, toErrorResponse } from "../lib/errors/error-response"

export default fp(async (app) => {
  app.setNotFoundHandler((request, reply) => {
    const error = new AppError(ERROR_CODES.NOT_FOUND, 404, "Route not found.")

    return reply
      .status(error.statusCode)
      .send(toErrorResponse(error, request.id))
  })

  app.setErrorHandler((error, request, reply) => {
    const appError = toAppError(error)

    if (appError.statusCode >= 500) {
      request.log.error({ err: error }, appError.message)
    } else {
      request.log.warn({ err: error }, appError.message)
    }

    if (isAppError(appError) && appError.headers) {
      reply.headers(appError.headers)
    }

    return reply
      .status(appError.statusCode)
      .send(toErrorResponse(appError, request.id))
  })
})
