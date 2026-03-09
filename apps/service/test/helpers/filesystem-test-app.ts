import Fastify from "fastify"

import errorHandlerPlugin from "../../src/plugins/error-handler"
import { registerFileSystemModuleRoutes } from "../../src/modules/filesystem"

export async function createFileSystemTestApp(args: { rootDirectory: string }) {
  const app = Fastify({
    logger: false,
  })

  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerFileSystemModuleRoutes(instance, {
        rootDirectory: args.rootDirectory,
      })
    },
    {
      prefix: "/v1",
    },
  )

  await app.ready()
  return app
}
