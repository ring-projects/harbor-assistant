import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
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

  it("loads defaults from the service config file and resolves relative paths", async () => {
    const rootDirectory = await mkdtemp(path.join(tmpdir(), "harbor-config-"))
    tempDirs.push(rootDirectory)
    const configPath = path.join(rootDirectory, "harbor.config.json")

    await writeFile(
      configPath,
      JSON.stringify(
        {
          service: {
            host: "127.0.0.1",
            port: 4500,
            name: "harbor-local",
          },
          paths: {
            runtimeRootDirectory: "./runtime",
            fileBrowserRootDirectory: "./workspace",
          },
          urls: {
            appBaseUrl: "https://service.example.com",
            webBaseUrl: "https://app.example.com",
          },
          auth: {
            allowedGitHubUsers: ["octocat"],
            allowedGitHubOrgs: ["harbor"],
            sessionCookieDomain: ".example.com",
          },
        },
        null,
        2,
      ),
      "utf8",
    )

    const config = await loadServiceConfig({
      env: {
        HARBOR_CONFIG_PATH: configPath,
        DATABASE_URL: "file:./dev.sqlite",
        NODE_ENV: "test",
      },
    })

    expect(config.host).toBe("127.0.0.1")
    expect(config.port).toBe(4500)
    expect(config.serviceName).toBe("harbor-local")
    expect(config.database).toBe("file:./dev.sqlite")
    expect(config.fileBrowserRootDirectory).toBe(
      path.join(rootDirectory, "workspace"),
    )
    expect(config.projectLocalPathRootDirectory).toBe(
      path.join(rootDirectory, "runtime", "workspaces"),
    )
    expect(config.publicSkillsRootDirectory).toBe(
      path.join(rootDirectory, "runtime", "skills", "profiles", "default"),
    )
    expect(config.appBaseUrl).toBe("https://service.example.com")
    expect(config.webBaseUrl).toBe("https://app.example.com")
    expect(config.allowedGitHubUsers).toEqual(["octocat"])
    expect(config.allowedGitHubOrgs).toEqual(["harbor"])
    expect(config.sessionCookieDomain).toBe(".example.com")
  })

  it("does not let env shadow project-level values from the config file", async () => {
    const rootDirectory = await mkdtemp(path.join(tmpdir(), "harbor-config-"))
    tempDirs.push(rootDirectory)
    const configPath = path.join(rootDirectory, "harbor.config.json")

    await writeFile(
      configPath,
      JSON.stringify(
        {
          service: {
            host: "127.0.0.1",
            port: 4500,
            name: "harbor-local",
          },
          paths: {
            runtimeRootDirectory: "./runtime",
            fileBrowserRootDirectory: "./workspace",
            projectLocalPathRootDirectory: "./custom-workspaces",
            publicSkillsRootDirectory: "./custom-skills",
          },
          urls: {
            appBaseUrl: "https://service.example.com",
            webBaseUrl: "https://app.example.com",
          },
          auth: {
            allowedGitHubUsers: ["octocat"],
            allowedGitHubOrgs: ["harbor"],
            sessionCookieDomain: "example.com",
          },
        },
        null,
        2,
      ),
      "utf8",
    )

    const config = await loadServiceConfig({
      env: {
        HARBOR_CONFIG_PATH: configPath,
        DATABASE_URL: "postgresql://localhost:5432/harbor",
        HOST: "0.0.0.0",
        PORT: "4600",
        APP_BASE_URL: "https://override.example.com",
        WEB_BASE_URL: "https://override-app.example.com",
        ALLOWED_GITHUB_USERS: "somebody",
        ALLOWED_GITHUB_ORGS: "another-org",
        NODE_ENV: "test",
      },
    })

    expect(config.host).toBe("127.0.0.1")
    expect(config.port).toBe(4500)
    expect(config.fileBrowserRootDirectory).toBe(
      path.join(rootDirectory, "workspace"),
    )
    expect(config.projectLocalPathRootDirectory).toBe(
      path.join(rootDirectory, "custom-workspaces"),
    )
    expect(config.publicSkillsRootDirectory).toBe(
      path.join(rootDirectory, "custom-skills"),
    )
    expect(config.appBaseUrl).toBe("https://service.example.com")
    expect(config.webBaseUrl).toBe("https://app.example.com")
    expect(config.allowedGitHubUsers).toEqual(["octocat"])
    expect(config.allowedGitHubOrgs).toEqual(["harbor"])
    expect(config.sessionCookieDomain).toBe("example.com")
  })

  it("accepts workspaceRootDirectory as a backward-compatible alias", async () => {
    const rootDirectory = await mkdtemp(path.join(tmpdir(), "harbor-config-"))
    tempDirs.push(rootDirectory)
    const configPath = path.join(rootDirectory, "harbor.config.json")

    await writeFile(
      configPath,
      JSON.stringify(
        {
          service: {
            host: "127.0.0.1",
            port: 4500,
            name: "harbor-local",
          },
          paths: {
            runtimeRootDirectory: "./runtime",
            workspaceRootDirectory: "./legacy-workspaces",
          },
          urls: {
            appBaseUrl: "https://service.example.com",
          },
        },
        null,
        2,
      ),
      "utf8",
    )

    const config = await loadServiceConfig({
      env: {
        HARBOR_CONFIG_PATH: configPath,
        DATABASE_URL: "file:./dev.sqlite",
        NODE_ENV: "test",
      },
    })

    expect(config.projectLocalPathRootDirectory).toBe(
      path.join(rootDirectory, "legacy-workspaces"),
    )
  })

  it("requires DATABASE_URL once Harbor home config fallback is removed", async () => {
    await expect(
      loadServiceConfig({
        env: {
          NODE_ENV: "test",
        },
      }),
    ).rejects.toThrow("Invalid Harbor service config")
  })

  it("requires appBaseUrl in the project config", async () => {
    const rootDirectory = await mkdtemp(path.join(tmpdir(), "harbor-config-"))
    tempDirs.push(rootDirectory)
    const configPath = path.join(rootDirectory, "harbor.config.json")

    await writeFile(
      configPath,
      JSON.stringify(
        {
          service: {
            host: "127.0.0.1",
            port: 4500,
            name: "harbor-local",
          },
        },
        null,
        2,
      ),
      "utf8",
    )

    await expect(
      loadServiceConfig({
        env: {
          HARBOR_CONFIG_PATH: configPath,
          DATABASE_URL: "file:./dev.sqlite",
          NODE_ENV: "test",
        },
      }),
    ).rejects.toThrow("Invalid Harbor service config")
  })
})
