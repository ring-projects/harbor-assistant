"use client"

import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
} from "react"

import { createProjectStore, type ProjectStore } from "../store"

const ProjectStoreContext = createContext<ProjectStore | null>(null)

type ProjectStoreProviderProps = {
  projectId: string
  children: ReactNode
}

export function ProjectStoreProvider({
  projectId,
  children,
}: ProjectStoreProviderProps) {
  const storeRef = useRef<ProjectStore | null>(null)

  if (!storeRef.current) {
    storeRef.current = createProjectStore(projectId)
  }

  return (
    <ProjectStoreContext.Provider value={storeRef.current}>
      {children}
    </ProjectStoreContext.Provider>
  )
}

export function useProjectStoreContext() {
  const store = useContext(ProjectStoreContext)

  if (!store) {
    throw new Error(
      "useProjectStoreContext must be used within ProjectStoreProvider",
    )
  }

  return store
}
