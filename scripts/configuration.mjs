import { access, mkdir, writeFile } from "node:fs/promises"

import {
  DEFAULT_APP_CONFIG_CONTENT,
  OTTER_CONFIG_PATH,
  OTTER_DATA_DIRECTORY,
  OTTER_HOME_DIRECTORY,
} from "./constants.mjs"
import { getErrorCode } from "./utils.mjs"

async function checkConfigFileExists() {
  try {
    await access(OTTER_CONFIG_PATH)
    return true
  } catch (error) {
    if (getErrorCode(error) === "ENOENT") {
      return false
    }

    throw error
  }
}

export async function initializeOtterConfiguration() {
  const exists = await checkConfigFileExists()
  if (exists) {
    return {
      created: false,
    }
  }

  await mkdir(OTTER_HOME_DIRECTORY, { recursive: true })
  await mkdir(OTTER_DATA_DIRECTORY, { recursive: true })
  await writeFile(OTTER_CONFIG_PATH, DEFAULT_APP_CONFIG_CONTENT, "utf8")

  return {
    created: true,
  }
}
