import { PrismaClient } from "@prisma/client"
import { config } from "../config"

let prismaClient: PrismaClient | null = null

/**
 * 获取 Prisma 客户端实例
 * 用于在非 Fastify 上下文中访问数据库
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    if (!config.database) {
      throw new Error("Database config not found")
    }

    prismaClient = new PrismaClient({
      datasourceUrl: config.database,
      log: config.isProduction ? ["error"] : ["error", "warn", "info"],
    })
  }

  return prismaClient
}

/**
 * 关闭 Prisma 客户端连接
 */
export async function disconnectPrisma() {
  if (prismaClient) {
    await prismaClient.$disconnect()
    prismaClient = null
  }
}
