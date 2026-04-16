"use client"

import { Link, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { ArrowRightIcon, FolderOpenIcon, PlusIcon, UsersIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useReadProjectsQuery } from "@/modules/projects/hooks"
import {
  getWorkspaceActionError,
  useWorkspaceInvitationsQuery,
  useWorkspaceQuery,
} from "@/modules/workspaces/hooks"
import { useAppStore } from "@/stores/app.store"

type WorkspaceHomePageProps = {
  workspaceId: string
}

function describeWorkspaceKind(type: "personal" | "team") {
  return type === "personal" ? "Personal workspace" : "Team workspace"
}

export function WorkspaceHomePage({ workspaceId }: WorkspaceHomePageProps) {
  const navigate = useNavigate()
  const setActiveWorkspaceId = useAppStore((state) => state.setActiveWorkspaceId)
  const clearActiveProjectId = useAppStore((state) => state.clearActiveProjectId)
  const workspaceQuery = useWorkspaceQuery(workspaceId)
  const projectsQuery = useReadProjectsQuery({ workspaceId })
  const invitationsQuery = useWorkspaceInvitationsQuery(workspaceId)

  useEffect(() => {
    setActiveWorkspaceId(workspaceId)
    clearActiveProjectId()
  }, [clearActiveProjectId, setActiveWorkspaceId, workspaceId])

  const workspace = workspaceQuery.data
  const memberCount =
    workspace?.memberships.filter((membership) => membership.status === "active")
      .length ?? 0
  const invitationCount =
    invitationsQuery.data?.filter((invitation) => invitation.status === "pending")
      .length ?? 0

  return (
    <div className="bg-background text-foreground min-h-svh">
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-6 py-8 sm:px-8 lg:px-12 lg:py-12">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm font-medium">
              Workspace
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {workspace?.name ?? "Loading workspace"}
            </h1>
            <p className="text-muted-foreground text-sm leading-6">
              {workspace
                ? describeWorkspaceKind(workspace.type)
                : "Preparing workspace context."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void navigate({ to: "/workspaces" })}
            >
              Switch workspace
            </Button>
            <Button asChild>
              <Link
                to="/workspaces/$workspaceId/projects/new"
                params={{ workspaceId }}
              >
                <PlusIcon className="size-4" />
                New project
              </Link>
            </Button>
          </div>
        </div>

        <main className="grid flex-1 gap-8 py-10 lg:grid-cols-[1fr_320px]">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Projects</h2>
                <p className="text-muted-foreground text-sm">
                  Projects inside the current workspace.
                </p>
              </div>
            </div>

            {workspaceQuery.isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50/70 p-4 text-sm text-red-700">
                {getWorkspaceActionError(workspaceQuery.error)}
              </div>
            ) : null}

            {projectsQuery.isLoading ? (
              <div className="text-muted-foreground rounded-lg border p-4 text-sm">
                Loading projects...
              </div>
            ) : null}

            {projectsQuery.isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50/70 p-4 text-sm text-red-700">
                {projectsQuery.error instanceof Error
                  ? projectsQuery.error.message
                  : "Failed to load projects."}
              </div>
            ) : null}

            {!projectsQuery.isLoading &&
            !projectsQuery.isError &&
            (projectsQuery.data?.length ?? 0) === 0 ? (
              <div className="rounded-xl border border-dashed p-6">
                <p className="font-medium">No projects in this workspace yet.</p>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  Create or import a project after selecting the workspace.
                </p>
                <Button asChild className="mt-4">
                  <Link
                    to="/workspaces/$workspaceId/projects/new"
                    params={{ workspaceId }}
                  >
                    <PlusIcon className="size-4" />
                    Create first project
                  </Link>
                </Button>
              </div>
            ) : null}

            {!projectsQuery.isLoading &&
            !projectsQuery.isError &&
            (projectsQuery.data?.length ?? 0) > 0 ? (
              <div className="grid gap-3">
                {projectsQuery.data?.map((project) => (
                  <Link
                    key={project.id}
                    to="/workspaces/$workspaceId/projects/$projectId"
                    params={{ workspaceId, projectId: project.id }}
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-xl border px-5 py-4 transition-colors",
                      "hover:bg-accent/60",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FolderOpenIcon className="text-muted-foreground size-4 shrink-0" />
                        <span className="truncate font-medium">{project.name}</span>
                      </div>
                      <p className="text-muted-foreground mt-1 truncate text-sm">
                        {project.source.type === "git"
                          ? project.source.repositoryUrl
                          : project.rootPath ?? project.source.rootPath}
                      </p>
                    </div>
                    <ArrowRightIcon className="text-muted-foreground size-4 shrink-0" />
                  </Link>
                ))}
              </div>
            ) : null}
          </section>

          <aside className="space-y-4">
            <div className="bg-card rounded-xl border p-5">
              <p className="text-sm font-semibold">Workspace summary</p>
              <dl className="mt-4 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="font-medium">
                    {workspace ? describeWorkspaceKind(workspace.type) : "Loading"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Projects</dt>
                  <dd className="font-medium">{projectsQuery.data?.length ?? 0}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Members</dt>
                  <dd className="flex items-center gap-2 font-medium">
                    <UsersIcon className="text-muted-foreground size-4" />
                    {memberCount}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Invitations</dt>
                  <dd className="font-medium">{invitationCount}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </main>
      </div>
    </div>
  )
}
