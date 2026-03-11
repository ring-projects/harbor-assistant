import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useIsMobile } from "./use-mobile"

type MatchMediaListener = () => void

const originalInnerWidth = window.innerWidth

afterEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: originalInnerWidth,
  })
})

describe("useIsMobile", () => {
  it("tracks viewport width changes", async () => {
    const listeners = new Set<MatchMediaListener>()

    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: window.innerWidth < 768,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event: string, listener: MatchMediaListener) => {
        if (event === "change") {
          listeners.add(listener)
        }
      }),
      removeEventListener: vi.fn(
        (event: string, listener: MatchMediaListener) => {
          if (event === "change") {
            listeners.delete(listener)
          }
        },
      ),
      dispatchEvent: vi.fn(),
    }))

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1200,
    })

    const { result } = renderHook(() => useIsMobile())

    await waitFor(() => {
      expect(result.current).toBe(false)
    })

    act(() => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: 640,
      })
      listeners.forEach((listener) => listener())
    })

    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })
})
