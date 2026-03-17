import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { execFile } from "node:child_process"
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

export async function createTestDatabase(): Promise<TestDatabase> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "harbor-service-test-"))
  const databasePath = path.join(tempDir, "test.sqlite")
  const databaseUrl = `file:${databasePath}`

  await execFileAsync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"],
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
      await rm(tempDir, { recursive: true, force: true })
    },
  }
}
