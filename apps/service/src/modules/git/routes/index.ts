import type { FastifyInstance } from "fastify"

import { getProjectUseCase } from "../../project/application/get-project"
import type { ProjectRepository } from "../../project/application/project-repository"
import type { GitRepository } from "../application/git-repository"
import { checkoutBranchUseCase } from "../application/checkout-branch"
import { createBranchUseCase } from "../application/create-branch"
import { getDiffUseCase } from "../application/get-diff"
import { getRepositorySummaryUseCase } from "../application/get-repository-summary"
import { listBranchesUseCase } from "../application/list-branches"
import { toGitAppError } from "../git-app-error"
import {
  checkoutProjectGitBranchRouteSchema,
  createProjectGitBranchRouteSchema,
  getProjectGitDiffRouteSchema,
  getProjectGitRepositoryRouteSchema,
  listProjectGitBranchesRouteSchema,
  type CheckoutGitBranchBody,
  type CreateGitBranchBody,
  type GitProjectParams,
} from "../schemas"

export async function registerGitModuleRoutes(
  app: FastifyInstance,
  options: {
    projectRepository: Pick<ProjectRepository, "findById">
    gitRepository: GitRepository
  },
) {
  async function resolveProjectRoot(projectId: string) {
    const project = await getProjectUseCase(options.projectRepository, projectId)
    return project.rootPath
  }

  app.get<{ Params: GitProjectParams }>(
    "/projects/:projectId/git",
    {
      schema: getProjectGitRepositoryRouteSchema,
    },
    async (request) => {
      try {
        const path = await resolveProjectRoot(request.params.projectId)
        const repository = await getRepositorySummaryUseCase(options.gitRepository, {
          path,
        })

        return {
          ok: true,
          repository,
        }
      } catch (error) {
        throw toGitAppError(error)
      }
    },
  )

  app.get<{ Params: GitProjectParams }>(
    "/projects/:projectId/git/branches",
    {
      schema: listProjectGitBranchesRouteSchema,
    },
    async (request) => {
      try {
        const path = await resolveProjectRoot(request.params.projectId)
        const branches = await listBranchesUseCase(options.gitRepository, {
          path,
        })

        return {
          ok: true,
          branches,
        }
      } catch (error) {
        throw toGitAppError(error)
      }
    },
  )

  app.get<{ Params: GitProjectParams }>(
    "/projects/:projectId/git/diff",
    {
      schema: getProjectGitDiffRouteSchema,
    },
    async (request) => {
      try {
        const path = await resolveProjectRoot(request.params.projectId)
        const diff = await getDiffUseCase(options.gitRepository, {
          path,
        })

        return {
          ok: true,
          diff,
        }
      } catch (error) {
        throw toGitAppError(error)
      }
    },
  )

  app.post<{ Params: GitProjectParams; Body: CheckoutGitBranchBody }>(
    "/projects/:projectId/git/checkout",
    {
      schema: checkoutProjectGitBranchRouteSchema,
    },
    async (request) => {
      try {
        const path = await resolveProjectRoot(request.params.projectId)
        const repository = await checkoutBranchUseCase(options.gitRepository, {
          path,
          branchName: request.body.branchName,
        })

        return {
          ok: true,
          repository,
        }
      } catch (error) {
        throw toGitAppError(error)
      }
    },
  )

  app.post<{ Params: GitProjectParams; Body: CreateGitBranchBody }>(
    "/projects/:projectId/git/branches",
    {
      schema: createProjectGitBranchRouteSchema,
    },
    async (request) => {
      try {
        const path = await resolveProjectRoot(request.params.projectId)
        const branches = await createBranchUseCase(options.gitRepository, {
          path,
          branchName: request.body.branchName,
          checkout: request.body.checkout,
          fromRef: request.body.fromRef,
        })

        return {
          ok: true,
          branches,
        }
      } catch (error) {
        throw toGitAppError(error)
      }
    },
  )
}
