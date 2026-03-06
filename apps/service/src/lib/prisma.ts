import path from "node:path"

import { PrismaClient } from "@prisma/client"

function resolveDatabaseUrl() {
  const configuredValue = process.env.DATABASE_URL?.trim()
  if (configuredValue) {
    return configuredValue
  }

  const fallbackPath = path.join(
    process.env.HOME ?? "",
    ".harbor",
    "data",
    "tasks.sqlite",
  )
  return `file:${fallbackPath}`
}

declare global {
  var __harborServicePrisma: PrismaClient | undefined
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = resolveDatabaseUrl()
}

export const prisma =
  globalThis.__harborServicePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  })

if (process.env.NODE_ENV !== "production") {
  globalThis.__harborServicePrisma = prisma
}
