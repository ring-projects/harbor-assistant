import { access, mkdir } from "node:fs/promises"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { PrismaClient } from "@prisma/client"
import { buildChildProcessEnv } from "./process-env"

const REQUIRED_SQLITE_TABLES = [
  "projects",
  "orchestrations",
  "tasks",
  "executions",
  "execution_events",
] as const

function getServiceRootDirectory() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
}

function getPnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm"
}

function getSqliteFilePath(databaseUrl: string) {
  const trimmed = databaseUrl.trim()
  if (!trimmed.startsWith("file:")) {
    return null
  }

  const filePath = trimmed.slice("file:".length)
  return filePath ? path.resolve(filePath) : null
}

async function pathExists(pathname: string) {
  try {
    await access(pathname)
    return true
  } catch {
    return false
  }
}

async function inspectSqliteSchema(databaseUrl: string) {
  const prisma = new PrismaClient({
    datasourceUrl: databaseUrl,
    log: [],
  })

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${REQUIRED_SQLITE_TABLES.map(() => "?").join(", ")})`,
      ...REQUIRED_SQLITE_TABLES,
    )

    const names = new Set(rows.map((row) => row.name))
    return REQUIRED_SQLITE_TABLES.every((name) => names.has(name))
  } finally {
    await prisma.$disconnect()
  }
}

async function runPrismaDbPush(args: {
  databaseUrl: string
  serviceRootDirectory: string
}) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      getPnpmCommand(),
      ["exec", "prisma", "db", "push", "--skip-generate"],
      {
        cwd: args.serviceRootDirectory,
        stdio: "inherit",
        env: buildChildProcessEnv({
          DATABASE_URL: args.databaseUrl,
        }),
      },
    )

    child.on("error", reject)
    child.on("close", (code, signal) => {
      if (signal) {
        reject(new Error(`Prisma db push was terminated by signal ${signal}.`))
        return
      }

      if (code !== 0) {
        reject(new Error(`Prisma db push exited with code ${code ?? 1}.`))
        return
      }

      resolve()
    })
  })
}

export async function ensureServiceDatabaseInitialized(args: {
  databaseUrl: string
  serviceRootDirectory?: string
  inspectSqliteSchema?: (databaseUrl: string) => Promise<boolean>
  runPrismaDbPush?: (args: {
    databaseUrl: string
    serviceRootDirectory: string
  }) => Promise<void>
}) {
  const sqliteFilePath = getSqliteFilePath(args.databaseUrl)
  if (!sqliteFilePath) {
    return {
      action: "skipped-non-sqlite" as const,
    }
  }

  const serviceRootDirectory = args.serviceRootDirectory ?? getServiceRootDirectory()
  const databaseExists = await pathExists(sqliteFilePath)

  if (!databaseExists) {
    await mkdir(path.dirname(sqliteFilePath), { recursive: true })
    await (args.runPrismaDbPush ?? runPrismaDbPush)({
      databaseUrl: args.databaseUrl,
      serviceRootDirectory,
    })

    return {
      action: "migrated-missing-sqlite" as const,
      sqliteFilePath,
    }
  }

  const schemaInitialized = await (args.inspectSqliteSchema ?? inspectSqliteSchema)(
    args.databaseUrl,
  )

  if (!schemaInitialized) {
    await (args.runPrismaDbPush ?? runPrismaDbPush)({
      databaseUrl: args.databaseUrl,
      serviceRootDirectory,
    })

    return {
      action: "migrated-uninitialized-sqlite" as const,
      sqliteFilePath,
    }
  }

  return {
    action: "ready" as const,
    sqliteFilePath,
  }
}
