import { buildServiceApp } from "./app"
import { loadServiceConfig } from "./config"
import { logDockerSandboxReadiness } from "./modules/sandbox"

async function run() {
  const config = await loadServiceConfig()
  await logDockerSandboxReadiness({
    rootDirectory: config.sandboxRootDirectory,
    logger: console,
  })
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
    const normalizedListeningAddress = listeningAddress.replace(/\/$/, "")
    const directOpenApiJsonUrl = `${normalizedListeningAddress}/openapi.json`
    const directOpenApiYamlUrl = `${normalizedListeningAddress}/openapi.yaml`
    const directScalarReferenceUrl = `${normalizedListeningAddress}/reference/`
    console.info(`[harbor:bootstrap] listening at ${listeningAddress}`)
    console.info(`[harbor:bootstrap] openapi json ${directOpenApiJsonUrl}`)
    console.info(`[harbor:bootstrap] openapi yaml ${directOpenApiYamlUrl}`)
    console.info(
      `[harbor:bootstrap] scalar preview ${directScalarReferenceUrl}`,
    )
    if (normalizedAppBaseUrl !== normalizedListeningAddress) {
      console.info(
        `[harbor:bootstrap] configured appBaseUrl ${normalizedAppBaseUrl}`,
      )
    }
  } catch (error) {
    app.log.error(error)
    process.exitCode = 1
  }
}

void run()
