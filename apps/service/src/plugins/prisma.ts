import { PrismaClient } from "@prisma/client"
import fp from "fastify-plugin"
import { config } from "../config"

function createPrismaClient () {
  if (!config.database) {
    throw new Error(`can't find database config`)
  }

  return new PrismaClient({
    datasourceUrl: config.database,
    log: config.isProduction ? ["error"] : ["error", "warn", "info"]
  });
}


export default fp(
  async (app) => {
    const prisma = createPrismaClient();

    app.decorate("prisma", prisma)

    app.addHook("onClose", async () => {
      await prisma.$disconnect()
    })
  },
  { name: "prisma" },
)
