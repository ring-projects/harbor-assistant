import "server-only"

import path from "node:path"

import { PrismaClient } from "@prisma/client"

import { getAppConfig } from "@/utils/yaml-config"

declare global {
  var __harborPrisma: PrismaClient | undefined
}

if (!process.env.DATABASE_URL) {
  const databaseFile = path.resolve(getAppConfig().task.databaseFile)
  process.env.DATABASE_URL = `file:${databaseFile}`
}

export const prisma =
  globalThis.__harborPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalThis.__harborPrisma = prisma
}
