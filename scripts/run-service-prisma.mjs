import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { resolveHarborConfig } from "./harbor-config.mjs"

const serviceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../apps/service",
)

function getBunxCommand() {
  return process.platform === "win32" ? "bunx.cmd" : "bunx"
}

async function run() {
  const prismaArgs = process.argv.slice(2)
  if (prismaArgs.length === 0) {
    console.error("[service-prisma] missing prisma arguments")
    process.exitCode = 1
    return
  }

  const harbor = await resolveHarborConfig({
    env: process.env,
  })

  const child = spawn(
    getBunxCommand(),
    ["--bun", "prisma", ...prismaArgs],
    {
      cwd: serviceRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL?.trim() || harbor.databaseUrl,
      },
    },
  )

  await new Promise((resolve) => {
    child.on("close", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal)
        return
      }

      process.exitCode = code ?? 1
      resolve(undefined)
    })
  })
}

run().catch((error) => {
  console.error("[service-prisma] failed:", error)
  process.exitCode = 1
})
