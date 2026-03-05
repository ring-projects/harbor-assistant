"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

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
  const [store] = useState<DirectoryPickerStore>(() =>
    createDirectoryPickerStore(initialPath),
  )

  return (
    <DirectoryPickerStoreContext.Provider value={store}>
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
