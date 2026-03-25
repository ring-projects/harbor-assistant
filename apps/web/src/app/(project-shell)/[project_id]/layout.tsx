"use client"

import { useParams } from "next/navigation"

import { ProjectSidebar } from "@/modules/projects"

type ProjectLayoutProps = {
  children: React.ReactNode
}

export default function ProjectLayout({ children }: ProjectLayoutProps) {
  const params = useParams<{ project_id?: string | string[] }>()
  const routeProjectId = params.project_id
  const projectId = Array.isArray(routeProjectId)
    ? routeProjectId[0] ?? ""
    : routeProjectId ?? ""

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <ProjectSidebar projectId={projectId} />
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
