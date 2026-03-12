import { buildServiceApp } from "./app"
import { loadServiceConfig } from "./config"
import { ensureServiceDatabaseInitialized } from "./lib/database-init"

async function run() {
  const config = await loadServiceConfig()
  const databaseInit = await ensureServiceDatabaseInitialized({
    databaseUrl: config.database,
  })
  if (databaseInit.action !== "ready" && databaseInit.action !== "skipped-non-sqlite") {
    console.info(
      `[harbor:db-init] ${databaseInit.action} (${databaseInit.sqliteFilePath})`,
    )
  }
  const app = await buildServiceApp(config)

  const closeApp = async () => {
    await app.close()
    process.exit(0)
  }

  process.on("SIGTERM", () => {
    void closeApp()
  })
  process.on("SIGINT", () => {
    void closeApp()
  })

  try {
    await app.listen({
      port: config.port,
      host: config.host,
    })
  } catch (error) {
    app.log.error(error)
    process.exitCode = 1
  }
}

void run()
