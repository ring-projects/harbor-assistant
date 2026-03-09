import type { FastifyInstance } from "fastify"

import { createFileSystemRepository } from "../repositories"
import { createFileSystemService } from "../services"
import { registerFileSystemRoutes } from "./filesystem.routes"

export async function registerFileSystemModuleRoutes(
  app: FastifyInstance,
  args: { rootDirectory: string },
) {
  const fileSystemRepository = createFileSystemRepository()
  const fileSystemService = createFileSystemService({
    fileSystemRepository,
    rootDirectory: args.rootDirectory,
  })

  await registerFileSystemRoutes(app, {
    fileSystemService,
  })
}
