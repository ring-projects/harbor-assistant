"use client"

import { useStore } from "zustand"

import { useProjectStoreContext } from "../providers"
import type { ProjectStoreState } from "../store"

export function useProjectStore<T>(
  selector: (state: ProjectStoreState) => T,
): T {
  return useStore(useProjectStoreContext(), selector)
}
