import { homedir } from "node:os"
import path from "node:path"

export const OTTER_HOME_DIRECTORY = path.join(homedir(), ".otter")
export const OTTER_DATA_DIRECTORY = path.join(OTTER_HOME_DIRECTORY, "data")
export const OTTER_CONFIG_PATH = path.join(OTTER_HOME_DIRECTORY, "app.yaml")

export const DEFAULT_APP_CONFIG_CONTENT = `fileBrowser:
  rootDirectory: "~"

workspace:
  dataFile: "~/.otter/data/workspaces.json"

task:
  dataFile: "~/.otter/data/tasks.json"
`
