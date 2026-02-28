import {
  BotIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
} from "lucide-react"

import { TaskAutoRefresh } from "@/components/tasks/task-auto-refresh"
import { TaskRunnerForm } from "@/components/tasks/task-runner-form"
import { listTasksByProject } from "@/services/tasks/task.repository"
import type { TaskStatus } from "@/services/tasks/types"
import { getProjectById } from "@/services/project/project.repository"
import { cn } from "@/lib/utils"

type ProjectTasksPageProps = {
  params: Promise<{
    project_id: string
  }>
}

function getStatusBadgeClass(status: TaskStatus) {
  if (status === "running") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700"
  }
  if (status === "completed") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
  }
  if (status === "failed") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-700"
  }
  return "border-amber-500/30 bg-amber-500/10 text-amber-700"
}

function getStatusIcon(status: TaskStatus) {
  if (status === "running") {
    return <CircleDashedIcon className="size-4" />
  }
  if (status === "completed") {
    return <CircleCheckIcon className="size-4" />
  }
  if (status === "failed") {
    return <CircleXIcon className="size-4" />
  }
  return <CircleDashedIcon className="size-4" />
}

export default async function ProjectTasksPage(
  props: ProjectTasksPageProps,
) {
  const { project_id: projectId } = await props.params
  const project = await getProjectById(projectId)

  if (!project) {
    return (
      <div className="bg-muted/30 flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
        <section className="bg-card text-card-foreground rounded-xl border p-5">
          <p className="text-muted-foreground text-sm">Project not found</p>
          <p className="mt-2 font-mono text-sm">{projectId}</p>
        </section>
      </div>
    )
  }

  const tasks = await listTasksByProject({
    projectId,
    limit: 30,
  })
  const hasRunningTasks = tasks.some((task) => task.status === "running")

  return (
    <div className="bg-muted/30 flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <TaskAutoRefresh enabled={hasRunningTasks} />
      <section className="bg-card text-card-foreground rounded-xl border p-4">
        <div className="mb-4 flex items-center gap-2">
          <BotIcon className="text-muted-foreground size-5" />
          <div>
            <h1 className="text-xl font-semibold">Tasks</h1>
            <p className="text-muted-foreground text-sm">
              Create and run Codex tasks for this project.
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="rounded-lg border p-3">
            <TaskRunnerForm projectId={projectId} />
            <div className="text-muted-foreground mt-3 rounded-md border border-dashed p-2 text-xs">
              Executed command pattern:{" "}
              <code>codex exec --cd &lt;project&gt; &lt;prompt&gt;</code>
            </div>
          </aside>

          <article className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Recent Tasks</p>
              <span className="bg-muted text-muted-foreground rounded border px-2 py-0.5 text-xs">
                {tasks.length}
              </span>
            </div>

            {tasks.length === 0 ? (
              <p className="text-muted-foreground text-sm">No tasks yet.</p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((task) => (
                  <li key={task.id} className="rounded-md border">
                    <div className="flex items-center gap-2 border-b px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs uppercase",
                          getStatusBadgeClass(task.status),
                        )}
                      >
                        {getStatusIcon(task.status)}
                        {task.status}
                      </span>
                      <span className="text-muted-foreground font-mono text-[11px]">
                        {task.id}
                      </span>
                      <span className="text-muted-foreground ml-auto text-[11px]">
                        {task.createdAt}
                      </span>
                    </div>

                    <div className="space-y-2 px-3 py-2">
                      <p className="text-sm">{task.prompt}</p>
                      {task.model ? (
                        <p className="text-muted-foreground text-xs">
                          model: {task.model}
                        </p>
                      ) : null}
                      {task.command.length > 0 ? (
                        <p className="text-muted-foreground truncate font-mono text-xs">
                          {task.command.join(" ")}
                        </p>
                      ) : null}
                      {task.error ? (
                        <p className="border-destructive/30 bg-destructive/10 text-destructive rounded border px-2 py-1 text-xs">
                          {task.error}
                        </p>
                      ) : null}
                      {task.stdout ? (
                        <details className="group">
                          <summary className="text-muted-foreground cursor-pointer text-xs">
                            stdout
                          </summary>
                          <pre className="bg-muted mt-1 max-h-52 overflow-auto rounded border p-2 text-xs whitespace-pre-wrap">
                            {task.stdout}
                          </pre>
                        </details>
                      ) : null}
                      {task.stderr ? (
                        <details className="group">
                          <summary className="text-muted-foreground cursor-pointer text-xs">
                            stderr
                          </summary>
                          <pre className="bg-muted mt-1 max-h-52 overflow-auto rounded border p-2 text-xs whitespace-pre-wrap">
                            {task.stderr}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </section>
    </div>
  )
}
