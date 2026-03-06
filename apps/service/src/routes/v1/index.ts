import type { FastifyInstance } from "fastify"

import { registerCapabilitiesRoutes } from "./capabilities.routes"
import { registerFileSystemRoutes } from "./fs.routes"
import { registerMcpRoutes } from "./mcp.routes"
import { registerProjectRoutes } from "./projects.routes"
import { registerTaskRoutes } from "./tasks.routes"

export async function registerV1Routes(app: FastifyInstance) {
  await registerProjectRoutes(app)
  await registerFileSystemRoutes(app)
  await registerCapabilitiesRoutes(app)
  await registerTaskRoutes(app)
  await registerMcpRoutes(app)
}
