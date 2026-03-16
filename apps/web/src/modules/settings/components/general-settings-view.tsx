"use client"

import { AppWindowIcon, FolderGit2Icon, SparklesIcon } from "lucide-react"

import { Card } from "@/components/ui/card"

export function GeneralSettingsView() {
  return (
    <div className="bg-background flex min-h-full flex-col">
      <div className="border-b px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold">General Settings</h1>
            <span className="text-muted-foreground rounded-full border px-2 py-0.5 font-mono text-[11px]">
              Global
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage Harbor-wide defaults that project settings can inherit or
            override.
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid min-h-full gap-4 p-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="grid content-start gap-4">
            <Card className="p-4">
              <p className="text-sm font-semibold">Scope</p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                Values configured here act as defaults across the app. Project
                settings can inherit them or define overrides when a repository
                needs different behavior.
              </p>
            </Card>
          </aside>

          <section className="grid content-start gap-4">
            <Card className="grid gap-3 p-5">
              <div className="flex items-start gap-3">
                <div className="bg-muted text-muted-foreground rounded-lg p-2">
                  <AppWindowIcon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Settings center scaffolded</p>
                  <p className="text-muted-foreground mt-1 text-sm leading-6">
                    This section is ready to host Harbor-wide defaults such as
                    theme preferences, executor defaults, and other app-level
                    behavior.
                  </p>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="grid gap-3 p-5">
                <div className="flex items-start gap-3">
                  <div className="bg-muted text-muted-foreground rounded-lg p-2">
                    <SparklesIcon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Recommended next step</p>
                    <p className="text-muted-foreground mt-1 text-sm leading-6">
                      Move executor, model, and execution mode defaults into this
                      scope, then let project settings override only the fields a
                      project changes.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="grid gap-3 p-5">
                <div className="flex items-start gap-3">
                  <div className="bg-muted text-muted-foreground rounded-lg p-2">
                    <FolderGit2Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Project inheritance</p>
                    <p className="text-muted-foreground mt-1 text-sm leading-6">
                      When project-level overrides are introduced, each field in
                      the project view should clearly indicate whether it is
                      inherited from General or overridden for the active
                      project.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
