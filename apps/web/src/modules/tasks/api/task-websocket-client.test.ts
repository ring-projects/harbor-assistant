import { afterEach, describe, expect, it } from "vitest"

import { getTaskSocketBaseUrl } from "./task-websocket-client"

const originalExecutorApiBaseUrl = process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL

describe("getTaskSocketBaseUrl", () => {
  afterEach(() => {
    if (originalExecutorApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL
      return
    }

    process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL = originalExecutorApiBaseUrl
  })

  it("reuses the required executor API base URL", () => {
    process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL = "https://executor.example.com/"

    expect(getTaskSocketBaseUrl()).toBe("https://executor.example.com")
  })

  it("throws when the executor API base URL is missing", () => {
    delete process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL

    expect(() => getTaskSocketBaseUrl()).toThrow(
      "NEXT_PUBLIC_EXECUTOR_API_BASE_URL is required to connect the web app to the executor service.",
    )
  })
})
