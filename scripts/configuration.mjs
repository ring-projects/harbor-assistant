import { access, mkdir, writeFile } from "node:fs/promises"

import {
  DEFAULT_APP_CONFIG_CONTENT,
  HARBOR_CONFIG_PATH,
  HARBOR_DATA_DIRECTORY,
  HARBOR_HOME_DIRECTORY,
} from "./constants.mjs"
import { getErrorCode } from "./utils.mjs"

async function checkConfigFileExists() {
  try {
    await access(HARBOR_CONFIG_PATH)
    return true
  } catch (error) {
    if (getErrorCode(error) === "ENOENT") {
      return false
    }

    throw error
  }
}

export async function initializeHarborConfiguration() {
  const exists = await checkConfigFileExists()
  if (exists) {
    return {
      created: false,
    }
  }

  await mkdir(HARBOR_HOME_DIRECTORY, { recursive: true })
  await mkdir(HARBOR_DATA_DIRECTORY, { recursive: true })
  await writeFile(HARBOR_CONFIG_PATH, DEFAULT_APP_CONFIG_CONTENT, "utf8")

  return {
    created: true,
  }
}
