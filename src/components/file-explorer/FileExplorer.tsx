"use client"

import { useEffect, useState, useTransition } from "react"
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileImageIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  PlusIcon,
  Link2Icon,
} from "lucide-react"

import { loadDirectorySubtreeAction } from "@/app/actions/file-browser"
import { addWorkspaceAction } from "@/app/actions/workspaces"
import {
  useFileExplorerTreeStore,
  type ChildrenByPath,
  type ExpandedPaths,
  type NodesByPath,
} from "@/components/file-explorer/stores"
import {
  getTreeNodePadding,
  isImageFileName,
} from "@/components/file-explorer/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { FileExplorerState } from "@/services/file-browser/file-explorer-state"
import { useWorkspaceStore } from "@/stores"

type FileExplorerProps = {
  initialState?: FileExplorerState
}

function TreeNode(props: {
  nodePath: string
  level: number
  nodesByPath: NodesByPath
  childrenByPath: ChildrenByPath
  expandedPaths: ExpandedPaths
  onToggleFolder: (path: string) => void
  onAddWorkspace: (path: string) => void
  addingWorkspacePath: string | null
}) {
  const {
    nodePath,
    level,
    nodesByPath,
    childrenByPath,
    expandedPaths,
    onToggleFolder,
    onAddWorkspace,
    addingWorkspacePath,
  } = props

  const node = nodesByPath[nodePath]
  if (!node) {
    return null
  }

  const isDirectory = node.type === "directory"
  const isExpanded = isDirectory ? Boolean(expandedPaths[node.path]) : false
  const childPaths = childrenByPath[node.path] ?? []

  return (
    <li className="space-y-1">
      <div
        data-node-path={node.path}
        data-node-kind={isDirectory ? "directory" : "other"}
        data-node-level={String(level)}
        data-expanded={isDirectory && isExpanded ? "true" : "false"}
        className={cn(
          "hover:bg-muted/60 flex min-h-8 items-center gap-2 rounded-md px-2 py-1",
        )}
        style={{ paddingLeft: getTreeNodePadding(level) }}
      >
        {isDirectory ? (
          <button
            type="button"
            onClick={() => onToggleFolder(node.path)}
            className="hover:bg-muted text-muted-foreground inline-flex size-5 shrink-0 items-center justify-center rounded-sm"
            aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          >
            {isExpanded ? (
              <ChevronDownIcon className="size-4" />
            ) : (
              <ChevronRightIcon className="size-4" />
            )}
          </button>
        ) : (
          <span className="inline-flex size-5 shrink-0" />
        )}

        {node.type === "directory" ? (
          isExpanded ? (
            <FolderOpenIcon className="text-muted-foreground size-4 shrink-0" />
          ) : (
            <FolderIcon className="text-muted-foreground size-4 shrink-0" />
          )
        ) : node.type === "file" && isImageFileName(node.name) ? (
          <FileImageIcon className="text-muted-foreground size-4 shrink-0" />
        ) : node.type === "file" ? (
          <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
        ) : node.type === "symlink" ? (
          <Link2Icon className="text-muted-foreground size-4 shrink-0" />
        ) : null}

        <span className="flex-1 truncate text-sm font-medium">{node.name}</span>
        {isDirectory ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground size-7"
            onClick={() => onAddWorkspace(node.path)}
            disabled={addingWorkspacePath === node.path}
            aria-label="Add workspace from folder"
            title="Add workspace"
          >
            <PlusIcon className="size-4" />
          </Button>
        ) : null}
        <span className="text-muted-foreground hidden text-xs md:inline">
          {node.path}
        </span>
      </div>

      {childPaths.length > 0 && isExpanded ? (
        <ul className="space-y-1">
          {childPaths.map((childPath) => (
            <TreeNode
              key={childPath}
              nodePath={childPath}
              level={level + 1}
              nodesByPath={nodesByPath}
              childrenByPath={childrenByPath}
              expandedPaths={expandedPaths}
              onToggleFolder={onToggleFolder}
              onAddWorkspace={onAddWorkspace}
              addingWorkspacePath={addingWorkspacePath}
            />
          ))}
        </ul>
      ) : null}

      {node.truncated ? (
        <div
          className="text-muted-foreground ml-2 flex items-center gap-2 text-xs"
          style={{ paddingLeft: getTreeNodePadding(level) }}
        >
          <AlertTriangleIcon className="size-3.5" />
          Results truncated for this branch.
        </div>
      ) : null}
    </li>
  )
}

export function FileExplorer({ initialState }: FileExplorerProps) {
  const values = useFileExplorerTreeStore((store) => store.values)
  const meta = useFileExplorerTreeStore((store) => store.meta)
  const error = useFileExplorerTreeStore((store) => store.error)
  const rootPath = useFileExplorerTreeStore((store) => store.rootPath)
  const nodesByPath = useFileExplorerTreeStore((store) => store.nodesByPath)
  const childrenByPath = useFileExplorerTreeStore(
    (store) => store.childrenByPath,
  )
  const expandedPaths = useFileExplorerTreeStore((store) => store.expandedPaths)
  const hydrateFromActionState = useFileExplorerTreeStore(
    (store) => store.hydrateFromActionState,
  )
  const mergeSubtree = useFileExplorerTreeStore((store) => store.mergeSubtree)
  const setError = useFileExplorerTreeStore((store) => store.setError)
  const toggleFolder = useFileExplorerTreeStore((store) => store.toggleFolder)
  const hydrateWorkspaces = useWorkspaceStore(
    (store) => store.hydrateWorkspaces,
  )
  const setActiveWorkspace = useWorkspaceStore(
    (store) => store.setActiveWorkspace,
  )
  const [workspaceActionMessage, setWorkspaceActionMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const [addingWorkspacePath, setAddingWorkspacePath] = useState<string | null>(
    null,
  )
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!initialState) {
      return
    }

    hydrateFromActionState(initialState)
  }, [hydrateFromActionState, initialState])

  const rootNode = rootPath ? nodesByPath[rootPath] : null

  const onToggleFolder = async (path: string) => {
    const node = nodesByPath[path]
    if (!node || node.type !== "directory") {
      return
    }

    const isExpanded = Boolean(expandedPaths[path])
    if (isExpanded) {
      toggleFolder(path)
      return
    }

    toggleFolder(path)

    const hasLoadedChildren = Object.prototype.hasOwnProperty.call(
      childrenByPath,
      path,
    )
    if (hasLoadedChildren) {
      return
    }

    const response = await loadDirectorySubtreeAction({
      path,
      depth: 2,
      includeHidden: values.includeHidden,
    })

    if (response.ok) {
      mergeSubtree(response.result)
      setError(null)
      return
    }

    setError(response.error)
  }

  const onAddWorkspace = (nodePath: string) => {
    const normalizedNodePath = nodePath.trim()
    const root = meta?.root?.trim() ?? ""
    const resolvedPath =
      normalizedNodePath === "."
        ? root
        : normalizedNodePath.startsWith("/")
          ? normalizedNodePath
          : root
            ? `${root.replace(/\/+$/, "")}/${normalizedNodePath.replace(/^\/+/, "")}`
            : normalizedNodePath

    setAddingWorkspacePath(nodePath)
    startTransition(async () => {
      const response = await addWorkspaceAction({ path: resolvedPath })
      hydrateWorkspaces(response.workspaces)

      if (!response.ok) {
        setWorkspaceActionMessage({
          type: "error",
          text: response.error?.message ?? "Failed to add workspace.",
        })
        setAddingWorkspacePath(null)
        return
      }

      const addedWorkspace = response.workspaces.find(
        (workspace) => workspace.path === resolvedPath,
      )
      if (addedWorkspace) {
        setActiveWorkspace(addedWorkspace.id)
      }

      setWorkspaceActionMessage({
        type: "success",
        text: `Workspace added from ${resolvedPath}`,
      })
      setAddingWorkspacePath(null)
    })
  }

  return (
    <div className="bg-card text-card-foreground w-full rounded-xl">
      <ScrollArea className="max-h-[70vh]" viewportClassName="space-y-4 p-4">
        {workspaceActionMessage ? (
          <div
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              workspaceActionMessage.type === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
            )}
          >
            {workspaceActionMessage.text}
          </div>
        ) : null}

        {error ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
            {error}
          </div>
        ) : null}

        {rootNode ? (
          <ul className="space-y-1">
            <TreeNode
              nodePath={rootNode.path}
              level={0}
              nodesByPath={nodesByPath}
              childrenByPath={childrenByPath}
              expandedPaths={expandedPaths}
              onToggleFolder={(path) => {
                void onToggleFolder(path)
              }}
              onAddWorkspace={onAddWorkspace}
              addingWorkspacePath={isPending ? addingWorkspacePath : null}
            />
          </ul>
        ) : (
          <div className="text-muted-foreground text-sm">
            No directory loaded.
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
