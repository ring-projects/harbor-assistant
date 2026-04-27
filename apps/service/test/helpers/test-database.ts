import { randomUUID } from "node:crypto"
import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"
import { PrismaClient } from "@prisma/client"

const execFileAsync = promisify(execFile)

const serviceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
)

export type TestDatabase = {
  prisma: PrismaClient
  databaseUrl: string
  cleanup: () => Promise<void>
}

function getPnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm"
}

function getBaseTestDatabaseUrl() {
  const databaseUrl = process.env.TEST_DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required for service integration tests after removing SQLite test databases.",
    )
  }

  return databaseUrl
}

function buildSchemaName() {
  return `harbor_test_${randomUUID().replace(/-/g, "_")}`
}

function buildSchemaDatabaseUrl(databaseUrl: string, schema: string) {
  const url = new URL(databaseUrl)
  url.searchParams.set("schema", schema)
  return url.toString()
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const baseDatabaseUrl = getBaseTestDatabaseUrl()
  const schema = buildSchemaName()
  const databaseUrl = buildSchemaDatabaseUrl(baseDatabaseUrl, schema)
  const adminPrisma = new PrismaClient({
    datasourceUrl: baseDatabaseUrl,
  })

  try {
    await adminPrisma.$connect()
    await adminPrisma.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS "${schema}"`,
    )

    await execFileAsync(
      getPnpmCommand(),
      ["exec", "prisma", "db", "push", "--skip-generate"],
      {
        cwd: serviceRoot,
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
        },
      },
    )

    const prisma = new PrismaClient({
      datasourceUrl: databaseUrl,
    })

    await prisma.$connect()

    return {
      prisma,
      databaseUrl,
      cleanup: async () => {
        await prisma.$disconnect()
        await adminPrisma.$executeRawUnsafe(
          `DROP SCHEMA IF EXISTS "${schema}" CASCADE`,
        )
        await adminPrisma.$disconnect()
      },
    }
  } catch (error) {
    await adminPrisma
      .$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      .catch(() => {})
    await adminPrisma.$disconnect().catch(() => {})
    throw error
  }
}
