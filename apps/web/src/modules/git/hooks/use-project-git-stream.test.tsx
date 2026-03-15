// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useProjectGitStream } from "./use-project-git-stream"

const bindQueryClient = vi.fn()
const subscribeProjectGit = vi.fn()

vi.mock("@/modules/tasks/realtime/task-socket-manager", () => ({
  getTaskSocketManager: vi.fn(() => ({
    bindQueryClient,
    subscribeProjectGit,
  })),
}))

function createWrapper() {
  const queryClient = new QueryClient()

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

afterEach(() => {
  bindQueryClient.mockReset()
  subscribeProjectGit.mockReset()
})

describe("useProjectGitStream", () => {
  it("binds the query client before subscribing to project git updates", () => {
    const unsubscribe = vi.fn()
    subscribeProjectGit.mockReturnValue(unsubscribe)

    const { unmount } = renderHook(() => useProjectGitStream("project-1"), {
      wrapper: createWrapper(),
    })

    expect(bindQueryClient).toHaveBeenCalledTimes(1)
    expect(subscribeProjectGit).toHaveBeenCalledWith("project-1")

    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
