import { homedir } from "node:os"
import path from "node:path"

export const HARBOR_HOME_DIRECTORY = path.join(homedir(), ".harbor")
export const HARBOR_DATA_DIRECTORY = path.join(HARBOR_HOME_DIRECTORY, "data")
export const HARBOR_CONFIG_PATH = path.join(HARBOR_HOME_DIRECTORY, "app.yaml")

export const DEFAULT_APP_CONFIG_CONTENT = `fileBrowser:
  rootDirectory: "~"

project:
  dataFile: "~/.harbor/data/projects.sqlite"

task:
  dataFile: "~/.harbor/data/tasks.json"
`
