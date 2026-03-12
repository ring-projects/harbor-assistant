import {
  getHarborPaths,
  initializeHarborConfiguration,
} from "./harbor-config.mjs"
import { getErrorCode } from "./utils.mjs"

async function run() {
  const paths = getHarborPaths(process.env)
  console.info(`[init:harbor] starting (home: ${paths.homeDirectory})`)

  const result = await initializeHarborConfiguration()
  if (result.created) {
    console.info(`[init:harbor] created default config: ${paths.configPath}`)
  } else {
    console.info(`[init:harbor] config already exists: ${paths.configPath}`)
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
