import { initializeOtterConfiguration } from "./configuration.mjs"
import { OTTER_CONFIG_PATH, OTTER_HOME_DIRECTORY } from "./constants.mjs"
import { getErrorCode } from "./utils.mjs"

async function run() {
  console.info(`[init:otter] starting (home: ${OTTER_HOME_DIRECTORY})`)

  const result = await initializeOtterConfiguration()
  if (result.created) {
    console.info(`[init:otter] created default config: ${OTTER_CONFIG_PATH}`)
  } else {
    console.info(`[init:otter] config already exists: ${OTTER_CONFIG_PATH}`)
  }

  console.info("[init:otter] ready")
}

run().catch((error) => {
  const code = getErrorCode(error)
  if (code) {
    console.error(`[init:otter] failed (${code}):`, error)
  } else {
    console.error("[init:otter] failed:", error)
  }

  process.exitCode = 1
})
