"use client"

import { useStore } from "zustand"

import { useDirectoryPickerStoreContext } from "../providers/directory-picker-provider"
import type { DirectoryPickerStoreState } from "../types"

export function useDirectoryPickerStore<T>(
  selector: (state: DirectoryPickerStoreState) => T,
): T {
  return useStore(useDirectoryPickerStoreContext(), selector)
}
