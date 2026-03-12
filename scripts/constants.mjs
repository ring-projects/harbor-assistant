import {
  DEFAULT_APP_CONFIG_CONTENT,
  getHarborPaths,
} from "./harbor-config.mjs"

const paths = getHarborPaths(process.env)

export const HARBOR_HOME_DIRECTORY = paths.homeDirectory
export const HARBOR_DATA_DIRECTORY = paths.dataDirectory
export const HARBOR_CONFIG_PATH = paths.configPath
export { DEFAULT_APP_CONFIG_CONTENT }
