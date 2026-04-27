import type { FastifyInstance } from "fastify"

import { ERROR_CODES } from "../../../constants/errors"
import { AppError } from "../../../lib/errors/app-error"
import type { UserDirectory } from "../application/user-directory"
import {
  getCurrentUserRouteSchema,
  getUserRouteSchema,
  type UserIdParams,
} from "../schemas"

export async function registerUserModuleRoutes(
  app: FastifyInstance,
  options: {
    userDirectory: UserDirectory
  },
) {
  app.get(
    "/me",
    {
      schema: getCurrentUserRouteSchema,
    },
    async (request) => {
      return {
        ok: true,
        user: request.auth!.user,
      }
    },
  )

  app.get<{ Params: UserIdParams }>(
    "/users/:userId",
    {
      schema: getUserRouteSchema,
    },
    async (request) => {
      const user = await options.userDirectory.findById(request.params.userId)
      if (!user) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 404, "User not found.")
      }

      return {
        ok: true,
        user,
      }
    },
  )
}
