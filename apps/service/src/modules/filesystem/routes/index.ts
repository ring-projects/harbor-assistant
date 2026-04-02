import type { FastifyInstance } from "fastify"

import { createOwnerScopedProjectRepository } from "../../auth"
import { getProjectUseCase } from "../../project/application/get-project"
import { requireProjectWorkspace } from "../../project/domain/project"
import type { ProjectRepository } from "../../project/application/project-repository"
import {
  createBootstrapRootRegistry,
  type BootstrapFileSystemRootConfig,
} from "../application/bootstrap-root-registry"
import { createDirectoryUseCase } from "../application/create-directory"
import type { FileSystemRepository } from "../application/filesystem-repository"
import { listBootstrapDirectoryUseCase } from "../application/list-bootstrap-directory"
import { listDirectoryUseCase } from "../application/list-directory"
import { readTextFileUseCase } from "../application/read-text-file"
import { statBootstrapPathUseCase } from "../application/stat-bootstrap-path"
import { statPathUseCase } from "../application/stat-path"
import { writeTextFileUseCase } from "../application/write-text-file"
import { toFileSystemAppError } from "../filesystem-app-error"
import {
  createProjectDirectoryRouteSchema,
  listBootstrapFilesRouteSchema,
  listBootstrapRootsRouteSchema,
  listProjectFilesRouteSchema,
  readProjectTextFileRouteSchema,
  statBootstrapPathRouteSchema,
  statProjectPathRouteSchema,
  writeProjectTextFileRouteSchema,
  type BootstrapFilePathQuery,
  type BootstrapListDirectoryBody,
  type ProjectCreateDirectoryBody,
  type ProjectFilePathQuery,
  type ProjectFilesParams,
  type ProjectListDirectoryBody,
  type ProjectWriteTextFileBody,
} from "../schemas"

export async function registerFileSystemModuleRoutes(
  app: FastifyInstance,
  options: {
    projectRepository: Pick<ProjectRepository, "findById"> & {
      findByIdAndOwnerUserId?: ProjectRepository["findByIdAndOwnerUserId"]
    }
    fileSystemRepository: FileSystemRepository
    bootstrapRoots?: BootstrapFileSystemRootConfig[]
  },
) {
  const bootstrapRootRegistry = createBootstrapRootRegistry(
    options.fileSystemRepository,
    options.bootstrapRoots ?? [],
  )

  async function resolveProjectRoot(projectId: string, ownerUserId: string) {
    const project = await getProjectUseCase(
      createOwnerScopedProjectRepository(
        options.projectRepository as ProjectRepository,
        ownerUserId,
      ),
      projectId,
    )
    return requireProjectWorkspace(project).rootPath
  }

  app.get(
    "/bootstrap/filesystem/roots",
    {
      schema: listBootstrapRootsRouteSchema,
    },
    async () => {
      try {
        return {
          ok: true,
          roots: await bootstrapRootRegistry.listRoots(),
        }
      } catch (error) {
        throw toFileSystemAppError(error)
      }
    },
  )

  app.post<{ Body: BootstrapListDirectoryBody }>(
    "/bootstrap/filesystem/list",
    {
      schema: listBootstrapFilesRouteSchema,
    },
    async (request) => {
      try {
        const listing = await listBootstrapDirectoryUseCase(
          options.fileSystemRepository,
          options.bootstrapRoots ?? [],
          request.body,
        )

        return {
          ok: true,
          listing,
        }
      } catch (error) {
        throw toFileSystemAppError(error)
      }
    },
  )

  app.get<{ Querystring: BootstrapFilePathQuery }>(
    "/bootstrap/filesystem/stat",
    {
      schema: statBootstrapPathRouteSchema,
    },
    async (request) => {
      try {
        const pathInfo = await statBootstrapPathUseCase(
          options.fileSystemRepository,
          options.bootstrapRoots ?? [],
          request.query,
        )

        return {
          ok: true,
          pathInfo,
        }
      } catch (error) {
        throw toFileSystemAppError(error)
      }
    },
  )

  app.post<{ Params: ProjectFilesParams; Body: ProjectListDirectoryBody }>(
    "/projects/:projectId/files/list",
    {
      schema: listProjectFilesRouteSchema,
    },
    async (request) => {
      try {
        const rootPath = await resolveProjectRoot(
          request.params.projectId,
          request.auth!.userId,
        )
        const listing = await listDirectoryUseCase(options.fileSystemRepository, {
          rootPath,
          path: request.body?.path,
          cursor: request.body?.cursor,
          limit: request.body?.limit,
          includeHidden: request.body?.includeHidden,
        })

        return {
          ok: true,
          listing,
        }
      } catch (error) {
        throw toFileSystemAppError(error)
      }
    },
  )

  app.get<{ Params: ProjectFilesParams; Querystring: ProjectFilePathQuery }>(
    "/projects/:projectId/files/stat",
    {
      schema: statProjectPathRouteSchema,
    },
    async (request) => {
      try {
        const rootPath = await resolveProjectRoot(
          request.params.projectId,
          request.auth!.userId,
        )
        const pathInfo = await statPathUseCase(options.fileSystemRepository, {
          rootPath,
          path: request.query.path,
        })

        return {
          ok: true,
          pathInfo,
        }
      } catch (error) {
        throw toFileSystemAppError(error)
      }
    },
  )

  app.get<{ Params: ProjectFilesParams; Querystring: ProjectFilePathQuery }>(
    "/projects/:projectId/files/text",
    {
      schema: readProjectTextFileRouteSchema,
    },
    async (request) => {
      try {
        const rootPath = await resolveProjectRoot(
          request.params.projectId,
          request.auth!.userId,
        )
        const file = await readTextFileUseCase(options.fileSystemRepository, {
          rootPath,
          path: request.query.path,
        })

        return {
          ok: true,
          file,
        }
      } catch (error) {
        throw toFileSystemAppError(error)
      }
    },
  )

  app.post<{ Params: ProjectFilesParams; Body: ProjectWriteTextFileBody }>(
    "/projects/:projectId/files/text",
    {
      schema: writeProjectTextFileRouteSchema,
    },
    async (request) => {
      try {
        const rootPath = await resolveProjectRoot(
          request.params.projectId,
          request.auth!.userId,
        )
        const file = await writeTextFileUseCase(options.fileSystemRepository, {
          rootPath,
          path: request.body.path,
          content: request.body.content,
          createParents: request.body.createParents,
        })

        return {
          ok: true,
          file,
        }
      } catch (error) {
        throw toFileSystemAppError(error)
      }
    },
  )

  app.post<{ Params: ProjectFilesParams; Body: ProjectCreateDirectoryBody }>(
    "/projects/:projectId/files/directories",
    {
      schema: createProjectDirectoryRouteSchema,
    },
    async (request) => {
      try {
        const rootPath = await resolveProjectRoot(
          request.params.projectId,
          request.auth!.userId,
        )
        const directory = await createDirectoryUseCase(options.fileSystemRepository, {
          rootPath,
          path: request.body.path,
          recursive: request.body.recursive,
        })

        return {
          ok: true,
          directory,
        }
      } catch (error) {
        throw toFileSystemAppError(error)
      }
    },
  )
}
