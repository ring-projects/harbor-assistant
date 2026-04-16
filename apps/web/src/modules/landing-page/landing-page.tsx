"use client"

import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { HarborMark } from "@/components/logo"
import { CreateProject } from "@/modules/projects/components"
import type { Project } from "@/modules/projects/types"
import { useAppStore } from "@/stores/app.store"

const landingPageFontFamily = [
  '"Berkeley Mono"',
  '"IBM Plex Mono"',
  "ui-monospace",
  "SFMono-Regular",
  "Menlo",
  "Monaco",
  "Consolas",
  '"Liberation Mono"',
  '"Courier New"',
  "monospace",
].join(", ")

export function LandingPage(props: { workspaceId?: string | null }) {
  const navigate = useNavigate()
  const clearActiveProjectId = useAppStore((state) => state.clearActiveProjectId)
  const setActiveWorkspaceId = useAppStore((state) => state.setActiveWorkspaceId)

  useEffect(() => {
    setActiveWorkspaceId(props.workspaceId ?? null)
    clearActiveProjectId()
  }, [clearActiveProjectId, props.workspaceId, setActiveWorkspaceId])

  function handleProjectCreated(project: Project) {
    void navigate({
      to: "/workspaces/$workspaceId/projects/$projectId",
      params: {
        workspaceId: project.workspaceId ?? props.workspaceId ?? "personal",
        projectId: project.id,
      },
    })
  }

  return (
    <div
      className="bg-background text-foreground min-h-svh"
      style={{ fontFamily: landingPageFontFamily }}
    >
      <div className="grid min-h-svh lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex min-h-[42svh] flex-col border-b px-6 py-8 sm:px-10 sm:py-10 lg:min-h-svh lg:border-r lg:border-b-0 lg:px-12 lg:py-12">
          <div className="flex items-center gap-3">
            <HarborMark
              variant="adaptive"
              width={24}
              height={24}
              className="size-6 shrink-0"
            />
            <p className="text-base leading-6 font-medium">
              harbor assistant
            </p>
          </div>

          <div className="flex flex-1 items-center py-12 sm:py-14 lg:py-0">
            <div className="max-w-xl space-y-10">
              <div className="space-y-6">
                <p className="text-muted-foreground text-sm leading-6 font-medium">
                  new project
                </p>
                <h1 className="max-w-[14ch] text-[32px] leading-[1.5] font-bold sm:text-[38px]">
                  Create a project and open it immediately.
                </h1>
                <p className="text-muted-foreground max-w-xl text-base leading-7">
                  Register a local path, connect a GitHub repository, or paste a
                  manual git URL. The project opens as soon as setup completes.
                </p>
              </div>

              <div className="border-border/80 space-y-5 border-t pt-8">
                <div className="space-y-1">
                  <p className="text-base leading-6 font-bold">
                    Local workspace
                  </p>
                  <p className="text-muted-foreground text-base leading-7">
                    Point Harbor at an existing server-local directory and use it
                    as the project root.
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-base leading-6 font-bold">
                    GitHub-connected repos
                  </p>
                  <p className="text-muted-foreground text-base leading-7">
                    Select an installed GitHub App account and create a project
                    from an authorized repository.
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-base leading-6 font-bold">
                    Manual git source
                  </p>
                  <p className="text-muted-foreground text-base leading-7">
                    Paste any repository URL when you want Harbor to track the
                    source without GitHub App setup.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-muted-foreground text-sm leading-6">
            The creation flow starts here directly. No extra launcher step.
          </p>
        </aside>

        <main className="bg-background text-foreground flex min-h-svh items-start px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
          <section className="mx-auto w-full max-w-2xl">
            <div className="border-border/80 border-b pb-6">
              <h2 className="text-[24px] leading-[1.5] font-bold">
                New project
              </h2>
              <p className="text-muted-foreground mt-2 max-w-[52ch] text-base leading-7">
                Choose the source that matches this workspace and finish setup in
                one pass.
              </p>
            </div>

            <CreateProject
              appearance="landing"
              className="pt-6"
              workspaceId={props.workspaceId}
              pickerTitle={null}
              submitLabel="Create and Open"
              onCreated={handleProjectCreated}
            />
          </section>
        </main>
      </div>
    </div>
  )
}
