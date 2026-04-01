"use client"

import { useEffect } from "react"
import { useRouter } from "@tanstack/react-router"

type TaskAutoRefreshProps = {
  enabled: boolean
  intervalMs?: number
}

export function TaskAutoRefresh(props: TaskAutoRefreshProps) {
  const { enabled, intervalMs = 2500 } = props
  const router = useRouter()

  useEffect(() => {
    if (!enabled) {
      return
    }

    const timer = window.setInterval(() => {
      void router.invalidate()
    }, intervalMs)

    return () => {
      window.clearInterval(timer)
    }
  }, [enabled, intervalMs, router])

  return null
}
