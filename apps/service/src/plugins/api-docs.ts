import fastifySwagger from "@fastify/swagger"
import fastifyApiReference from "@scalar/fastify-api-reference"
import fp from "fastify-plugin"

import type { ServiceConfig } from "../config"
import { HARBOR_SESSION_COOKIE_NAME } from "../modules/auth/constants"
import { getServiceBuildInfo } from "../version"

type ApiDocsPluginOptions = {
  config: ServiceConfig
}

const API_TAGS = [
  { name: "service", description: "Service health and version metadata." },
  { name: "auth", description: "Authentication and session endpoints." },
  { name: "agents", description: "Available task agent capabilities." },
  { name: "workspace", description: "Workspace membership and settings." },
  {
    name: "projects",
    description: "Project management and repository binding.",
  },
  { name: "tasks", description: "Task execution and task assets." },
  { name: "filesystem", description: "Project file browsing and file access." },
  { name: "git", description: "Project Git status, history, and actions." },
  { name: "orchestration", description: "Project orchestration lifecycle." },
  { name: "github", description: "GitHub app integration endpoints." },
] as const

export default fp(
  async (app, options: ApiDocsPluginOptions) => {
    const buildInfo = getServiceBuildInfo()

    await app.register(fastifySwagger, {
      stripBasePath: false,
      openapi: {
        openapi: "3.0.3",
        info: {
          title: "Harbor Service API",
          description:
            "OpenAPI for the Harbor service. Coverage is route-schema driven and currently partial.",
          version: buildInfo.version,
        },
        servers: [
          {
            url: options.config.appBaseUrl,
            description: "Configured service base URL.",
          },
        ],
        tags: [...API_TAGS],
        components: {
          securitySchemes: {
            cookieAuth: {
              type: "apiKey",
              in: "cookie",
              name: HARBOR_SESSION_COOKIE_NAME,
            },
            bearerAuth: {
              type: "http",
              scheme: "bearer",
            },
          },
        },
      },
    })

    app.get(
      "/openapi.json",
      {
        schema: {
          hide: true,
        },
      },
      async (_request, reply) => {
        return reply.send(app.swagger())
      },
    )

    app.get(
      "/openapi.yaml",
      {
        schema: {
          hide: true,
        },
      },
      async (_request, reply) => {
        return reply.type("application/yaml").send(app.swagger({ yaml: true }))
      },
    )

    await app.register(fastifyApiReference, {
      routePrefix: "/reference",
      configuration: {
        url: "/openapi.json",
      },
    })
  },
  {
    name: "api-docs",
  },
)
