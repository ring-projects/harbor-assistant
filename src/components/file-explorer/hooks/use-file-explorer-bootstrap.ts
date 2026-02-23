"use client"

import { useEffect, useRef } from "react"

import { getInitialFileExplorerStateAction } from "@/app/actions/file-browser"
import { useFileExplorerTreeStore } from "@/components/file-explorer/stores"

export function useFileExplorerBootstrap(open: boolean) {
  const hydrateFromActionState = useFileExplorerTreeStore(
    (store) => store.hydrateFromActionState,
  )
  const setError = useFileExplorerTreeStore((store) => store.setError)
  const rootPath = useFileExplorerTreeStore((store) => store.rootPath)
  const inFlightRef = useRef(false)
  const hasBootstrappedRef = useRef(false)

  useEffect(() => {
    if (rootPath) {
      hasBootstrappedRef.current = true
    }
  }, [rootPath])

  useEffect(() => {
    if (!open || hasBootstrappedRef.current || inFlightRef.current) {
      return
    }

    let active = true
    inFlightRef.current = true

    void getInitialFileExplorerStateAction()
      .then((state) => {
        if (!active) {
          return
        }

        hydrateFromActionState(state)
        hasBootstrappedRef.current = true
      })
      .catch(() => {
        if (!active) {
          return
        }

        hasBootstrappedRef.current = true
        setError("Failed to initialize file explorer.")
      })
      .finally(() => {
        inFlightRef.current = false
      })

    return () => {
      active = false
    }
  }, [open, hydrateFromActionState, setError])
}
