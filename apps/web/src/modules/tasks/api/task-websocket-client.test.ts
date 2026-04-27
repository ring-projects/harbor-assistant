import { afterEach, describe, expect, it } from "vitest"

import { getTaskSocketBaseUrl } from "./task-websocket-client"

const originalHarborApiBaseUrl = process.env.VITE_HARBOR_API_BASE_URL

describe("getTaskSocketBaseUrl", () => {
  afterEach(() => {
    if (originalHarborApiBaseUrl === undefined) {
      delete process.env.VITE_HARBOR_API_BASE_URL
      return
    }

    process.env.VITE_HARBOR_API_BASE_URL = originalHarborApiBaseUrl
  })

  it("reuses the required Harbor API base URL", () => {
    process.env.VITE_HARBOR_API_BASE_URL = "https://executor.example.com/"

    expect(getTaskSocketBaseUrl()).toBe("https://executor.example.com")
  })

  it("throws when the Harbor API base URL is missing", () => {
    delete process.env.VITE_HARBOR_API_BASE_URL

    expect(() => getTaskSocketBaseUrl()).toThrow(
      "VITE_HARBOR_API_BASE_URL is required to connect the web app to the Harbor API.",
    )
  })
})
