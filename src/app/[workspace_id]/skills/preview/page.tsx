import Link from "next/link"
import { ArrowLeftIcon, FolderSearch2Icon, SparklesIcon } from "lucide-react"

import { MarkdownPreview } from "@/components/documents/preview"
import {
  getCodexSkillPreviewForWorkspace,
  resolveCodexSkillsForWorkspace,
} from "@/services/codex-config/config.service"
import type { CodexConfigSource } from "@/services/codex-config/types"
import { getWorkspaceById } from "@/services/workspace/workspace.repository"
import { cn } from "@/lib/utils"

type WorkspaceSkillPreviewPageProps = {
  params: Promise<{
    workspace_id: string
  }>
  searchParams: Promise<{
    source?: string | string[]
    name?: string | string[]
    file?: string | string[]
  }>
}

function normalizeSource(value: string | undefined): CodexConfigSource | null {
  if (!value) {
    return null
  }

  return value === "global" || value === "project" ? value : null
}

export default async function WorkspaceSkillPreviewPage(
  props: WorkspaceSkillPreviewPageProps
) {
  const [{ workspace_id: workspaceId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])
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
  const sourceParamRaw = Array.isArray(searchParams.source)
    ? searchParams.source[0]
    : searchParams.source
  const nameParamRaw = Array.isArray(searchParams.name)
    ? searchParams.name[0]
    : searchParams.name
  const fileParamRaw = Array.isArray(searchParams.file)
    ? searchParams.file[0]
    : searchParams.file

  const selectedSkillFromQuery =
    sourceParamRaw && nameParamRaw
      ? skillsResult.skills.find(
          (skill) =>
            skill.source === normalizeSource(sourceParamRaw) &&
            skill.name === nameParamRaw
        )
      : null
  const selectedSkill = selectedSkillFromQuery ?? skillsResult.skills[0] ?? null

  const skillPreview = selectedSkill
    ? await getCodexSkillPreviewForWorkspace({
        workspacePath: workspace.path,
        source: selectedSkill.source,
        skillName: selectedSkill.name,
        selectedFilePath: fileParamRaw ?? null,
      })
    : null

  return (
    <div className="bg-muted/30 flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <section className="bg-card text-card-foreground rounded-xl border p-3">
        <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-border space-y-2 rounded-lg border p-2">
            <div className="flex items-center gap-2 border-b px-2 pb-2">
              <Link
                href={`/${workspaceId}/skills`}
                className="hover:bg-muted inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
              >
                <ArrowLeftIcon className="size-3.5" />
                Back
              </Link>
              <p className="text-muted-foreground text-xs">Skills</p>
            </div>

            {skillsResult.skills.length > 0 ? (
              <ul className="max-h-[70vh] space-y-1 overflow-auto">
                {skillsResult.skills.map((skill) => {
                  const isSelected =
                    selectedSkill &&
                    skill.source === selectedSkill.source &&
                    skill.name === selectedSkill.name

                  return (
                    <li key={`${skill.source}:${skill.path}`}>
                      <Link
                        href={`/${workspaceId}/skills/preview?source=${skill.source}&name=${encodeURIComponent(skill.name)}`}
                        className={cn(
                          "hover:bg-muted/60 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                          isSelected && "bg-muted",
                        )}
                      >
                        <SparklesIcon className="text-muted-foreground size-4 shrink-0" />
                        <span className="truncate">{skill.name}</span>
                        <span className="bg-muted rounded px-1.5 py-0.5 text-[10px] uppercase">
                          {skill.source}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="text-muted-foreground flex items-center gap-2 px-2 py-6 text-sm">
                <FolderSearch2Icon className="size-4 shrink-0" />
                No skills found.
              </div>
            )}
          </aside>

          <article className="border-border min-h-[60vh] space-y-4 rounded-lg border p-4">
            {!selectedSkill ? (
              <p className="text-muted-foreground text-sm">No skills available.</p>
            ) : !skillPreview ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Failed to load skill preview.</p>
                <p className="text-muted-foreground text-xs">
                  Ensure `SKILL.md` exists under this skill directory.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1 border-b pb-3">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold">{skillPreview.skill.name}</h1>
                    <span className="bg-muted rounded px-2 py-0.5 text-xs uppercase">
                      {skillPreview.skill.source}
                    </span>
                  </div>
                  <p className="text-muted-foreground truncate font-mono text-xs">
                    {skillPreview.skill.path}
                  </p>
                  <p className="text-muted-foreground truncate font-mono text-xs">
                    {skillPreview.skill.skillFilePath}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border p-2">
                    <p className="text-muted-foreground mb-1 text-xs">references</p>
                    {skillPreview.supportFiles.references.length > 0 ? (
                      <ul className="space-y-1">
                        {skillPreview.supportFiles.references.slice(0, 20).map((item) => (
                          <li key={item} className="truncate font-mono text-xs">
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground text-xs">none</p>
                    )}
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-muted-foreground mb-1 text-xs">scripts</p>
                    {skillPreview.supportFiles.scripts.length > 0 ? (
                      <ul className="space-y-1">
                        {skillPreview.supportFiles.scripts.slice(0, 20).map((item) => (
                          <li key={item} className="truncate font-mono text-xs">
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground text-xs">none</p>
                    )}
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-muted-foreground mb-1 text-xs">assets</p>
                    {skillPreview.supportFiles.assets.length > 0 ? (
                      <ul className="space-y-1">
                        {skillPreview.supportFiles.assets.slice(0, 20).map((item) => (
                          <li key={item} className="truncate font-mono text-xs">
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground text-xs">none</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
                  <aside className="rounded-md border p-2">
                    <p className="text-muted-foreground mb-2 text-xs">Files</p>
                    {skillPreview.files.length > 0 ? (
                      <ul className="max-h-[60vh] space-y-1 overflow-auto">
                        {skillPreview.files.map((file) => {
                          const selected =
                            skillPreview.selectedFile?.relativePath ===
                            file.relativePath

                          return (
                            <li key={file.absolutePath}>
                              <Link
                                href={`/${workspaceId}/skills/preview?source=${selectedSkill.source}&name=${encodeURIComponent(selectedSkill.name)}&file=${encodeURIComponent(file.relativePath)}`}
                                className={cn(
                                  "hover:bg-muted/60 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                                  selected && "bg-muted",
                                )}
                              >
                                <span className="truncate font-mono">
                                  {file.relativePath}
                                </span>
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        No files in this skill folder.
                      </p>
                    )}
                  </aside>

                  <div className="rounded-md border p-3">
                    {skillPreview.selectedFile ? (
                      <>
                        <p className="text-muted-foreground mb-3 truncate font-mono text-xs">
                          {skillPreview.selectedFile.relativePath}
                        </p>
                        {skillPreview.selectedFile.isMarkdown ? (
                          <MarkdownPreview content={skillPreview.selectedFile.content} />
                        ) : (
                          <pre className="bg-muted overflow-auto rounded-md border p-3 text-xs whitespace-pre">
                            {skillPreview.selectedFile.content}
                          </pre>
                        )}
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Selected file is not available for preview.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </article>
        </div>
      </section>
    </div>
  )
}
