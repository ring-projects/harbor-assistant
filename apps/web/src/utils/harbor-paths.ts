import { homedir } from "node:os"
import path from "node:path"

export const HARBOR_HOME_DIRECTORY = path.join(homedir(), ".harbor")
export const HARBOR_DATA_DIRECTORY = path.join(HARBOR_HOME_DIRECTORY, "data")
export const HARBOR_APP_CONFIG_PATH = path.join(
  HARBOR_HOME_DIRECTORY,
  "app.yaml",
)
export const HARBOR_PROJECT_DATA_FILE = path.join(
  HARBOR_DATA_DIRECTORY,
  "projects.sqlite",
)
export const HARBOR_TASK_DATABASE_FILE = path.join(
  HARBOR_DATA_DIRECTORY,
  "tasks.sqlite",
)
export const HARBOR_TASK_DATA_FILE = path.join(
  HARBOR_DATA_DIRECTORY,
  "tasks.json",
)
