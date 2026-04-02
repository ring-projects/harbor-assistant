import "fastify"

import type { AuthenticatedRequestContext } from "../modules/auth"

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthenticatedRequestContext | null
  }
}
