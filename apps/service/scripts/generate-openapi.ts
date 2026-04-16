import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import "dotenv/config"

import { buildServiceApp } from "../src/app"
import { loadServiceConfig } from "../src/config"
import { ensureServiceDatabaseInitialized } from "../src/lib/database-init"

async function run() {
  const config = await loadServiceConfig()
  await ensureServiceDatabaseInitialized({
    databaseUrl: config.database,
  })

  const app = await buildServiceApp(config)

  try {
    await app.ready()

    const currentFilePath = fileURLToPath(import.meta.url)
    const serviceRootDirectory = path.resolve(path.dirname(currentFilePath), "..")
    const outputDirectory = path.join(serviceRootDirectory, "generated", "openapi")
    const jsonPath = path.join(outputDirectory, "openapi.json")
    const yamlPath = path.join(outputDirectory, "openapi.yaml")

    await mkdir(outputDirectory, { recursive: true })
    await writeFile(jsonPath, `${JSON.stringify(app.swagger(), null, 2)}\n`, "utf8")
    await writeFile(yamlPath, `${app.swagger({ yaml: true })}\n`, "utf8")

    console.info(`[harbor:openapi] wrote ${jsonPath}`)
    console.info(`[harbor:openapi] wrote ${yamlPath}`)
  } finally {
    await app.close()
  }
}

void run()
