import { PrismaClient, type Prisma } from "@prisma/client"
import fp from "fastify-plugin"

type PrismaPluginOptions = {
  datasourceUrl: string
  log: Prisma.LogLevel[]
}

function createPrismaClient(options: PrismaPluginOptions) {
  return new PrismaClient({
    datasourceUrl: options.datasourceUrl,
    log: options.log,
  })
}

export default fp(
  async (app, options: PrismaPluginOptions) => {
    const prisma = createPrismaClient(options)

    app.decorate("prisma", prisma)

    app.addHook("onClose", async () => {
      await prisma.$disconnect()
    })
  },
  { name: "prisma" },
)
