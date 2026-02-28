"use client"

import Link from "next/link"
import { FormEvent, useMemo, useState } from "react"
import {
  FolderOpenIcon,
  LoaderCircleIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { Project } from "@/services/project/types"

import {
  getProjectActionError,
  useAddProjectMutation,
  useDeleteProjectMutation,
  useProjectsQuery,
} from "./hooks"

function formatCreatedTime(project: Project) {
  const createdDate = new Date(project.createdAt)
  if (Number.isNaN(createdDate.getTime())) {
    return project.createdAt
  }

  return createdDate.toLocaleString()
}

export function ProjectView() {
  const projectsQuery = useProjectsQuery()
  const addProjectMutation = useAddProjectMutation()
  const deleteProjectMutation = useDeleteProjectMutation()

  const [projectPath, setProjectPath] = useState("")
  const [projectName, setProjectName] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  const projects = projectsQuery.data ?? []
  const isInitialLoading = projectsQuery.isLoading && !projectsQuery.data
  const deletingProjectId = deleteProjectMutation.isPending
    ? deleteProjectMutation.variables
    : null

  const queryErrorMessage = projectsQuery.error
    ? getProjectActionError(projectsQuery.error)
    : null
  const mutationErrorMessage = useMemo(() => {
    if (addProjectMutation.error) {
      return getProjectActionError(addProjectMutation.error)
    }
    if (deleteProjectMutation.error) {
      return getProjectActionError(deleteProjectMutation.error)
    }
    return null
  }, [addProjectMutation.error, deleteProjectMutation.error])
  const errorMessage = localError ?? mutationErrorMessage ?? queryErrorMessage

  function resetError() {
    setLocalError(null)
  }

  async function handleAddProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetError()

    const trimmedPath = projectPath.trim()
    if (!trimmedPath) {
      setLocalError("Project path is required.")
      return
    }

    try {
      await addProjectMutation.mutateAsync({
        path: trimmedPath,
        name: projectName.trim() || undefined,
      })
      setProjectPath("")
      setProjectName("")
    } catch (error) {
      setLocalError(getProjectActionError(error))
    }
  }

  return (
    <div className="bg-muted/30 flex flex-1 justify-center">
      <div className="flex w-full max-w-5xl flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Projects</CardTitle>
            <CardDescription>
              Manage project roots used by the workflow runtime.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_auto]"
              onSubmit={(event) => {
                void handleAddProject(event)
              }}
            >
              <Input
                placeholder="Project path (absolute or relative)"
                value={projectPath}
                onChange={(event) => {
                  resetError()
                  setProjectPath(event.target.value)
                }}
                disabled={addProjectMutation.isPending}
              />
              <Input
                placeholder="Display name (optional)"
                value={projectName}
                onChange={(event) => {
                  resetError()
                  setProjectName(event.target.value)
                }}
                disabled={addProjectMutation.isPending}
              />
              <Button
                type="submit"
                disabled={addProjectMutation.isPending || !projectPath.trim()}
              >
                {addProjectMutation.isPending ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : (
                  <PlusIcon className="size-4" />
                )}
                Add Project
              </Button>
            </form>

            {errorMessage ? (
              <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
                {errorMessage}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project List</CardTitle>
            <CardDescription>
              {projects.length} project{projects.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isInitialLoading ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <LoaderCircleIcon className="size-4 animate-spin" />
                Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No projects yet. Add one using the form above.
              </p>
            ) : (
              <ul className="space-y-2">
                {projects.map((project) => (
                  <li
                    key={project.id}
                    className="bg-background rounded-lg border px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{project.name}</p>
                        <p className="text-muted-foreground truncate font-mono text-xs">
                          {project.path}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatCreatedTime(project)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/${project.id}/tasks`}>
                            <FolderOpenIcon className="size-4" />
                            Open
                          </Link>
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            resetError()
                            deleteProjectMutation.mutate(project.id, {
                              onError(error) {
                                setLocalError(getProjectActionError(error))
                              },
                            })
                          }}
                          disabled={
                            deleteProjectMutation.isPending &&
                            deletingProjectId === project.id
                          }
                        >
                          {deleteProjectMutation.isPending &&
                          deletingProjectId === project.id ? (
                            <LoaderCircleIcon className="size-4 animate-spin" />
                          ) : (
                            <Trash2Icon className="size-4" />
                          )}
                          Delete
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
