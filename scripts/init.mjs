import { initializeHarborConfiguration } from "./configuration.mjs"
import { HARBOR_CONFIG_PATH, HARBOR_HOME_DIRECTORY } from "./constants.mjs"
import { getErrorCode } from "./utils.mjs"

async function run() {
  console.info(`[init:harbor] starting (home: ${HARBOR_HOME_DIRECTORY})`)

  const result = await initializeHarborConfiguration()
  if (result.created) {
    console.info(`[init:harbor] created default config: ${HARBOR_CONFIG_PATH}`)
  } else {
    console.info(`[init:harbor] config already exists: ${HARBOR_CONFIG_PATH}`)
  }

  console.info("[init:harbor] ready")
}

run().catch((error) => {
  const code = getErrorCode(error)
  if (code) {
    console.error(`[init:harbor] failed (${code}):`, error)
  } else {
    console.error("[init:harbor] failed:", error)
  }

  process.exitCode = 1
})
