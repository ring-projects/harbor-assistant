"use client"

import { Link } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowUpRightIcon,
  FolderGit2Icon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react"

import { ThemeToggle } from "@/modules/app"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProjectSwitcher } from "@/modules/projects"
import { useReadProjectsQuery } from "@/modules/projects/hooks"
import {
  useWorkspaceInvitationsQuery,
  useWorkspaceQuery,
} from "@/modules/workspaces/hooks"
import { useAppStore } from "@/stores/app.store"
import { useUiStore } from "@/stores/ui.store"

type WorkspaceHomePageProps = {
  workspaceId: string
}

function describeWorkspaceKind(type: "personal" | "team") {
  return type === "personal" ? "Personal workspace" : "Team workspace"
}

export function WorkspaceHomePage({ workspaceId }: WorkspaceHomePageProps) {
  const setActiveWorkspaceId = useAppStore(
    (state) => state.setActiveWorkspaceId,
  )
  const clearActiveProjectId = useAppStore(
    (state) => state.clearActiveProjectId,
  )
  const openAddProjectModal = useUiStore((state) => state.openAddProjectModal)
  const workspaceQuery = useWorkspaceQuery(workspaceId)
  const projectsQuery = useReadProjectsQuery({ workspaceId })
  const invitationsQuery = useWorkspaceInvitationsQuery(workspaceId)
  const [searchValue, setSearchValue] = useState("")

  useEffect(() => {
    setActiveWorkspaceId(workspaceId)
    clearActiveProjectId()
  }, [clearActiveProjectId, setActiveWorkspaceId, workspaceId])

  const workspace = workspaceQuery.data
  const projects = projectsQuery.data ?? []
  const projectCount = projects.length
  const memberCount =
    workspace?.memberships.filter(
      (membership) => membership.status === "active",
    ).length ?? 0
  const invitationCount =
    invitationsQuery.data?.filter(
      (invitation) => invitation.status === "pending",
    ).length ?? 0
  const gitProjectCount = projects.filter(
    (project) => project.source.type === "git",
  ).length

  const filteredProjects = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    if (!keyword) {
      return projects
    }

    return projects.filter((project) => {
      const haystack = [
        project.name,
        project.slug,
        project.description ?? "",
        project.source.type === "git"
          ? project.source.repositoryUrl
          : (project.rootPath ?? project.source.rootPath),
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(keyword)
    })
  }, [projects, searchValue])

  return (
    <div className="bg-surface-subtle h-full overflow-auto">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-5 py-4 sm:px-6 lg:px-8">
        <header className="border-border/60 flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
              Overview
            </p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
              {workspace?.name ?? "Loading workspace"}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full min-w-[15rem] sm:w-72">
              <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search projects..."
                className="border-border/70 bg-background h-10 rounded-lg pl-9 shadow-none"
              />
            </div>

            <ProjectSwitcher
              workspaceId={workspaceId}
              activeProjectId={null}
              className="border-border/70 bg-background h-10 rounded-lg px-3 shadow-none"
              triggerLabel="Open project switcher"
            >
              <span className="font-medium">Open project</span>
            </ProjectSwitcher>

            <Button
              type="button"
              className="h-10 rounded-lg px-4"
              onClick={() => openAddProjectModal(workspaceId)}
            >
              <PlusIcon className="size-4" />
              Add New
            </Button>

            <ThemeToggle />
          </div>
        </header>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <main className="space-y-4">
            <section className="grid gap-3 md:grid-cols-3">
              <div className="border-border/60 bg-background rounded-xl border px-4 py-4">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
                  Projects
                </p>
                <p className="mt-2 text-2xl font-semibold">{projectCount}</p>
              </div>

              <div className="border-border/60 bg-background rounded-xl border px-4 py-4">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
                  Members
                </p>
                <p className="mt-2 text-2xl font-semibold">{memberCount}</p>
              </div>

              <div className="border-border/60 bg-background rounded-xl border px-4 py-4">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
                  Pending invites
                </p>
                <p className="mt-2 text-2xl font-semibold">{invitationCount}</p>
              </div>
            </section>

            <section className="border-border/60 bg-background overflow-hidden rounded-xl border">
              <div className="border-border/60 flex items-center justify-between gap-3 border-b px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold">Projects</h2>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Enter a project directly from the workspace console.
                  </p>
                </div>
                <span className="text-muted-foreground text-xs">
                  {filteredProjects.length} visible
                </span>
              </div>

              {projectsQuery.isLoading ? (
                <div className="text-muted-foreground px-4 py-10 text-sm">
                  Loading projects...
                </div>
              ) : null}

              {!projectsQuery.isLoading && filteredProjects.length === 0 ? (
                <div className="px-4 py-10">
                  <div className="border-border/80 bg-secondary/15 rounded-xl border border-dashed px-4 py-8">
                    <p className="text-base font-medium">
                      {projectCount === 0
                        ? "This workspace does not have projects yet."
                        : "No projects match the current search."}
                    </p>
                    <p className="text-muted-foreground mt-2 text-sm leading-6">
                      {projectCount === 0
                        ? "Create or import a project and it will appear here."
                        : "Try a different project name, slug, or repository URL."}
                    </p>
                  </div>
                </div>
              ) : null}

              {filteredProjects.length > 0 ? (
                <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredProjects.map((project) => (
                    <Link
                      key={project.id}
                      to="/workspaces/$workspaceId/projects/$projectId"
                      params={{ workspaceId, projectId: project.id }}
                      className="group border-border/60 bg-background hover:bg-secondary/20 flex min-h-32 flex-col justify-between rounded-xl border p-4 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="bg-secondary/45 border-border/60 flex size-10 shrink-0 items-center justify-center rounded-lg border">
                          <FolderGit2Icon className="size-4" />
                        </span>
                        <ArrowUpRightIcon className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </div>

                      <div className="mt-6 min-w-0">
                        <p className="truncate text-base font-semibold">
                          {project.name}
                        </p>
                        {project.description ? (
                          <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-6">
                            {project.description}
                          </p>
                        ) : (
                          <p className="text-muted-foreground mt-2 text-sm leading-6">
                            Open project console
                          </p>
                        )}
                      </div>

                      <div className="mt-6">
                        <div className="text-muted-foreground border-border/70 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase">
                          {project.source.type === "git"
                            ? "Git-backed"
                            : "Local"}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}
            </section>
          </main>

          <aside className="space-y-4">
            <section className="border-border/60 bg-background rounded-xl border">
              <div className="border-border/60 border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Workspace</h2>
              </div>
              <div className="grid gap-3 px-4 py-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">
                    {workspace
                      ? describeWorkspaceKind(workspace.type)
                      : "Loading"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Slug</span>
                  <span className="font-medium">
                    {workspace?.slug ?? "..."}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Members</span>
                  <span className="flex items-center gap-2 font-medium">
                    <UsersIcon className="text-muted-foreground size-4" />
                    {memberCount}
                  </span>
                </div>
              </div>
            </section>

            <section className="border-border/60 bg-background rounded-xl border">
              <div className="border-border/60 border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Project mix</h2>
              </div>
              <div className="grid gap-3 px-4 py-4">
                <div className="border-border/60 bg-secondary/20 rounded-lg border px-3 py-3">
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
                    Git-backed
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    {gitProjectCount}
                  </p>
                </div>
                <div className="border-border/60 bg-secondary/20 rounded-lg border px-3 py-3">
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
                    Local
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    {projectCount - gitProjectCount}
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
