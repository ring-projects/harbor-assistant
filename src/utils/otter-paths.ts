import { homedir } from "node:os"
import path from "node:path"

export const OTTER_HOME_DIRECTORY = path.join(homedir(), ".otter")
export const OTTER_DATA_DIRECTORY = path.join(OTTER_HOME_DIRECTORY, "data")
export const OTTER_APP_CONFIG_PATH = path.join(OTTER_HOME_DIRECTORY, "app.yaml")
export const OTTER_WORKSPACE_DATA_FILE = path.join(
  OTTER_DATA_DIRECTORY,
  "workspaces.json",
)
export const OTTER_TASK_DATA_FILE = path.join(
  OTTER_DATA_DIRECTORY,
  "tasks.json",
)
