import type { FastifyInstance } from "fastify"

import {
  listDirectoryRouteSchema,
  type ListDirectoryBody,
} from "../schemas"
import type { FileSystemService } from "../services"

export async function registerFileSystemRoutes(
  app: FastifyInstance,
  args: { fileSystemService: FileSystemService },
) {
  const { fileSystemService } = args

  app.post<{ Body: ListDirectoryBody }>(
    "/fs/list",
    {
      schema: listDirectoryRouteSchema,
    },
    async (request) => {
      const result = await fileSystemService.listDirectory(request.body ?? {})

      return {
        ok: true,
        ...result,
      }
    },
  )
}
