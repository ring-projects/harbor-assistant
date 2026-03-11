import type { FastifyInstance } from "fastify"

import {
  checkoutGitBranchRouteSchema,
  createGitBranchRouteSchema,
  getGitDiffRouteSchema,
  getGitRepositoryRouteSchema,
  listGitBranchesRouteSchema,
  type CheckoutGitBranchBody,
  type CreateGitBranchBody,
  type GitProjectParams,
} from "../schemas"
import type { GitService } from "../services"

export async function registerGitRoutes(
  app: FastifyInstance,
  args: { gitService: GitService },
) {
  const { gitService } = args

  app.get<{ Params: GitProjectParams }>(
    "/projects/:projectId/git",
    {
      schema: getGitRepositoryRouteSchema,
    },
    async (request) => {
      const repository = await gitService.getRepositorySummary({
        projectId: request.params.projectId,
      })

      return {
        ok: true,
        repository,
      }
    },
  )

  app.get<{ Params: GitProjectParams }>(
    "/projects/:projectId/git/branches",
    {
      schema: listGitBranchesRouteSchema,
    },
    async (request) => {
      const result = await gitService.listBranches({
        projectId: request.params.projectId,
      })

      return {
        ok: true,
        ...result,
      }
    },
  )

  app.get<{ Params: GitProjectParams }>(
    "/projects/:projectId/git/diff",
    {
      schema: getGitDiffRouteSchema,
    },
    async (request) => {
      const diff = await gitService.getDiff({
        projectId: request.params.projectId,
      })

      return {
        ok: true,
        diff,
      }
    },
  )

  app.post<{ Params: GitProjectParams; Body: CheckoutGitBranchBody }>(
    "/projects/:projectId/git/checkout",
    {
      schema: checkoutGitBranchRouteSchema,
    },
    async (request) => {
      const repository = await gitService.checkoutBranch({
        projectId: request.params.projectId,
        branchName: request.body.branchName,
      })

      return {
        ok: true,
        repository,
      }
    },
  )

  app.post<{ Params: GitProjectParams; Body: CreateGitBranchBody }>(
    "/projects/:projectId/git/branches",
    {
      schema: createGitBranchRouteSchema,
    },
    async (request) => {
      const repository = await gitService.createBranch({
        projectId: request.params.projectId,
        branchName: request.body.branchName,
        checkout: request.body.checkout,
        fromRef: request.body.fromRef,
      })

      return {
        ok: true,
        repository,
      }
    },
  )
}
