import Link from "next/link"
import { CableIcon, FolderSearch2Icon } from "lucide-react"

import { setMcpServerEnabledAction } from "@/app/actions/codex-mcp"
import { resolveCodexMcpConfigForProject } from "@/services/codex-config/config.service"
import { getProjectById } from "@/services/project/project.repository"

type ProjectMcpPageProps = {
  params: Promise<{
    project_id: string
  }>
}

export default async function ProjectMcpPage(props: ProjectMcpPageProps) {
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

  const mcpResult = await resolveCodexMcpConfigForProject(project.path)

  return (
    <div className="bg-muted/30 flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <section className="bg-card text-card-foreground rounded-xl border p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Codex MCP Servers</h1>
            <p className="text-muted-foreground text-sm">
              Parsed from global and project `.codex/config.toml`.
            </p>
          </div>
          <Link
            href={`/${projectId}/skills`}
            className="hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
          >
            View Skills
          </Link>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Global Config</p>
            <p className="mt-1 truncate font-mono text-xs">
              {mcpResult.globalConfig.path}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {mcpResult.globalConfig.exists ? "Loaded" : "Not found"}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Project Config</p>
            <p className="mt-1 truncate font-mono text-xs">
              {mcpResult.projectConfig.path}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {mcpResult.projectConfig.exists ? "Loaded" : "Not found"}
            </p>
          </div>
        </div>

        {mcpResult.servers.length === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 rounded-md border border-dashed p-4 text-sm">
            <FolderSearch2Icon className="size-4 shrink-0" />
            No MCP servers found in current Codex configs.
          </div>
        ) : (
          <ul className="divide-border divide-y rounded-md border">
            {mcpResult.servers.map((server) => (
              <li key={server.name} className="space-y-2 px-3 py-3">
                <div className="flex items-center gap-2">
                  <CableIcon className="text-muted-foreground size-4 shrink-0" />
                  <span className="text-sm font-semibold">{server.name}</span>
                  <span className="bg-muted rounded px-2 py-0.5 text-xs uppercase">
                    {server.source}
                  </span>
                  {typeof server.enabled === "boolean" ? (
                    <span className="text-muted-foreground text-xs">
                      {server.enabled ? "enabled" : "disabled"}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    global:{" "}
                    {typeof server.globalEnabled === "boolean"
                      ? server.globalEnabled
                        ? "enabled"
                        : "disabled"
                      : "unset"}
                  </span>
                  <form action={setMcpServerEnabledAction}>
                    <input
                      type="hidden"
                      name="projectId"
                      value={projectId}
                    />
                    <input type="hidden" name="scope" value="global" />
                    <input
                      type="hidden"
                      name="serverName"
                      value={server.name}
                    />
                    <input
                      type="hidden"
                      name="enabled"
                      value={server.globalEnabled === false ? "true" : "false"}
                    />
                    <button
                      type="submit"
                      className="hover:bg-muted rounded-md border px-2 py-1 text-xs"
                    >
                      {server.globalEnabled === false
                        ? "Enable Global"
                        : "Disable Global"}
                    </button>
                  </form>

                  <span className="text-muted-foreground text-xs">
                    project:{" "}
                    {typeof server.projectEnabled === "boolean"
                      ? server.projectEnabled
                        ? "enabled"
                        : "disabled"
                      : "unset"}
                  </span>
                  <form action={setMcpServerEnabledAction}>
                    <input
                      type="hidden"
                      name="projectId"
                      value={projectId}
                    />
                    <input type="hidden" name="scope" value="project" />
                    <input
                      type="hidden"
                      name="serverName"
                      value={server.name}
                    />
                    <input
                      type="hidden"
                      name="enabled"
                      value={server.projectEnabled === false ? "true" : "false"}
                    />
                    <button
                      type="submit"
                      className="hover:bg-muted rounded-md border px-2 py-1 text-xs"
                    >
                      {server.projectEnabled === false
                        ? "Enable Project"
                        : "Disable Project"}
                    </button>
                  </form>
                </div>

                {server.url ? (
                  <p className="text-muted-foreground truncate font-mono text-xs">
                    url: {server.url}
                  </p>
                ) : null}

                {server.command ? (
                  <p className="text-muted-foreground truncate font-mono text-xs">
                    command: {server.command}
                  </p>
                ) : null}

                {server.args.length > 0 ? (
                  <p className="text-muted-foreground truncate font-mono text-xs">
                    args: {server.args.join(" ")}
                  </p>
                ) : null}

                {Object.keys(server.env).length > 0 ? (
                  <p className="text-muted-foreground truncate font-mono text-xs">
                    env keys: {Object.keys(server.env).join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
