"use client"

import { useEffect } from "react"

import { useUiStore } from "@/stores"

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const tagName = target.tagName.toLowerCase()
  return tagName === "input" || tagName === "textarea" || tagName === "select"
}

function isPrimaryHotkey(event: KeyboardEvent, key: string) {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === key
  )
}

export function GlobalHotkeys() {
  const openFileExplorerSheet = useUiStore(
    (store) => store.openFileExplorerSheet,
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return
      }

      if (isPrimaryHotkey(event, "k")) {
        event.preventDefault()
        openFileExplorerSheet()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [openFileExplorerSheet])

  return null
}
