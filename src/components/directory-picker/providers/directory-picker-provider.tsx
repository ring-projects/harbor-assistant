"use client"

import { createContext, useContext, useRef, type ReactNode } from "react"

import {
  createDirectoryPickerStore,
  type DirectoryPickerStore,
} from "../store/directory-picker.store"

const DirectoryPickerStoreContext = createContext<DirectoryPickerStore | null>(
  null,
)

type DirectoryPickerProviderProps = {
  children: ReactNode
  initialPath?: string
}

export function DirectoryPickerProvider({
  children,
  initialPath,
}: DirectoryPickerProviderProps) {
  const storeRef = useRef<DirectoryPickerStore | null>(null)

  if (!storeRef.current) {
    storeRef.current = createDirectoryPickerStore(initialPath)
  }

  return (
    <DirectoryPickerStoreContext.Provider value={storeRef.current}>
      {children}
    </DirectoryPickerStoreContext.Provider>
  )
}

export function useDirectoryPickerStoreContext() {
  const store = useContext(DirectoryPickerStoreContext)

  if (!store) {
    throw new Error(
      "useDirectoryPickerStoreContext must be used within DirectoryPickerProvider",
    )
  }

  return store
}
