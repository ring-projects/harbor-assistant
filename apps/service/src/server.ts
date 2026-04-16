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
  const normalizedAppBaseUrl = config.appBaseUrl.replace(/\/$/, "")
  const openApiJsonUrl = `${normalizedAppBaseUrl}/openapi.json`
  const openApiYamlUrl = `${normalizedAppBaseUrl}/openapi.yaml`
  const scalarReferenceUrl = `${normalizedAppBaseUrl}/reference/`

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
    const listeningAddress = await app.listen({
      port: config.port,
      host: config.host,
    })
    console.info(`[harbor:bootstrap] listening at ${listeningAddress}`)
    console.info(`[harbor:bootstrap] openapi json ${openApiJsonUrl}`)
    console.info(`[harbor:bootstrap] openapi yaml ${openApiYamlUrl}`)
    console.info(`[harbor:bootstrap] api reference ${scalarReferenceUrl}`)
  } catch (error) {
    app.log.error(error)
    process.exitCode = 1
  }
}

void run()
