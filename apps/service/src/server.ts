import { buildServiceApp } from "./app"
import { getServiceConfig } from "./config"

async function run() {
  const config = getServiceConfig()
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

    app.log.info(
      `[service] listening on http://${config.host}:${String(config.port)}`,
    )
  } catch (error) {
    app.log.error(error)
    process.exitCode = 1
  }
}

void run()
