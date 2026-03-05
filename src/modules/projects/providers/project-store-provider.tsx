"use client"

import {
  createContext,
  useContext,
  useState,
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
  const [store] = useState<ProjectStore>(() => createProjectStore(projectId))

  return (
    <ProjectStoreContext.Provider value={store}>
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
