import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { loadServiceConfig } from "./config"

describe("loadServiceConfig", () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.map(async (directory) => {
        await rm(directory, { recursive: true, force: true })
      }),
    )
    tempDirs.length = 0
  })

  it("creates Harbor config automatically and derives sqlite database URL", async () => {
    const homeDirectory = await mkdtemp(path.join(tmpdir(), "harbor-config-home-"))
    tempDirs.push(homeDirectory)

    const config = await loadServiceConfig({
      env: {
        HARBOR_HOME: homeDirectory,
        NODE_ENV: "test",
      },
    })

    expect(config.harborHomeDirectory).toBe(homeDirectory)
    expect(config.database).toBe(
      `file:${path.join(homeDirectory, "data", "harbor.sqlite")}`,
    )
    expect(config.fileBrowserRootDirectory).toBe(homedir())
    expect(config.trustProxy).toBe(false)

    const configPath = path.join(homeDirectory, "app.yaml")
    const content = await readFile(configPath, "utf8")
    expect(content).toContain("databaseFile: data/harbor.sqlite")
  })

  it("prefers Harbor app config values and still allows env overrides", async () => {
    const homeDirectory = await mkdtemp(path.join(tmpdir(), "harbor-config-home-"))
    tempDirs.push(homeDirectory)
    const configPath = path.join(homeDirectory, "app.yaml")

    await writeFile(
      configPath,
      [
        "service:",
        "  host: 127.0.0.1",
        "  port: 4500",
        "  name: harbor-local",
        "  trustProxy: true",
        "fileBrowser:",
        "  rootDirectory: ./workspace",
        "task:",
        "  databaseFile: ./data/custom.sqlite",
        "",
      ].join("\n"),
      "utf8",
    )

    const config = await loadServiceConfig({
      env: {
        HARBOR_HOME: homeDirectory,
        PORT: "4600",
        NODE_ENV: "test",
      },
    })

    expect(config.host).toBe("127.0.0.1")
    expect(config.port).toBe(4600)
    expect(config.serviceName).toBe("harbor-local")
    expect(config.trustProxy).toBe(true)
    expect(config.fileBrowserRootDirectory).toBe(
      path.join(homeDirectory, "workspace"),
    )
    expect(config.database).toBe(
      `file:${path.join(homeDirectory, "data", "custom.sqlite")}`,
    )
  })

  it("allows TRUST_PROXY env to override Harbor config", async () => {
    const homeDirectory = await mkdtemp(path.join(tmpdir(), "harbor-config-home-"))
    tempDirs.push(homeDirectory)

    const config = await loadServiceConfig({
      env: {
        HARBOR_HOME: homeDirectory,
        TRUST_PROXY: "true",
        NODE_ENV: "test",
      },
    })

    expect(config.trustProxy).toBe(true)
  })
})
