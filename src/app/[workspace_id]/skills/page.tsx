import Link from "next/link"
import { FolderSearch2Icon, SparklesIcon } from "lucide-react"

import { resolveCodexSkillsForWorkspace } from "@/services/codex-config/config.service"
import { getWorkspaceById } from "@/services/workspace/workspace.repository"

type WorkspaceSkillsPageProps = {
  params: Promise<{
    workspace_id: string
  }>
}

export default async function WorkspaceSkillsPage(
  props: WorkspaceSkillsPageProps,
) {
  const { workspace_id: workspaceId } = await props.params
  const workspace = await getWorkspaceById(workspaceId)

  if (!workspace) {
    return (
      <div className="bg-muted/30 flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
        <section className="bg-card text-card-foreground rounded-xl border p-5">
          <p className="text-muted-foreground text-sm">Workspace not found</p>
          <p className="mt-2 font-mono text-sm">{workspaceId}</p>
        </section>
      </div>
    )
  }

  const skillsResult = await resolveCodexSkillsForWorkspace(workspace.path)

  return (
    <div className="bg-muted/30 flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <section className="bg-card text-card-foreground rounded-xl border p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Codex Skills</h1>
            <p className="text-muted-foreground text-sm">
              Loaded from global and project `.codex/skills` directories.
            </p>
          </div>
          <Link
            href={`/${workspaceId}/mcp`}
            className="hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
          >
            View MCP
          </Link>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Global Skills Root</p>
            <p className="mt-1 truncate font-mono text-xs">
              {skillsResult.globalSkillsRoot.path}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {skillsResult.globalSkillsRoot.exists ? "Available" : "Not found"}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Project Skills Root</p>
            <p className="mt-1 truncate font-mono text-xs">
              {skillsResult.projectSkillsRoot.path}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {skillsResult.projectSkillsRoot.exists
                ? "Available"
                : "Not found"}
            </p>
          </div>
        </div>

        {skillsResult.skills.length === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 rounded-md border border-dashed p-4 text-sm">
            <FolderSearch2Icon className="size-4 shrink-0" />
            No skills found.
          </div>
        ) : (
          <ul className="divide-border divide-y rounded-md border">
            {skillsResult.skills.map((skill) => (
              <li key={`${skill.source}:${skill.path}`} className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="text-muted-foreground size-4 shrink-0" />
                  <Link
                    href={`/${workspaceId}/skills/preview?source=${skill.source}&name=${encodeURIComponent(skill.name)}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {skill.name}
                  </Link>
                  <span className="bg-muted rounded px-2 py-0.5 text-xs uppercase">
                    {skill.source}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 truncate font-mono text-xs">
                  {skill.path}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
