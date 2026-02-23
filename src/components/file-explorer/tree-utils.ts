import type {
  BrowseDirectoryResult,
  FileTreeNode,
} from "@/services/file-browser/types"

type ExpandedPaths = Record<string, true>
type NodesByPath = Record<string, FileTreeNode>
type ChildrenByPath = Record<string, string[]>

function flattenTree(
  node: FileTreeNode,
  nodesByPath: NodesByPath,
  childrenByPath: ChildrenByPath,
) {
  nodesByPath[node.path] = node

  if (node.type !== "directory" || !node.children) {
    return
  }

  childrenByPath[node.path] = node.children.map((childNode) => childNode.path)

  for (const childNode of node.children) {
    flattenTree(childNode, nodesByPath, childrenByPath)
  }
}

export function toTreeMaps(result: BrowseDirectoryResult) {
  const nodesByPath: NodesByPath = {}
  const childrenByPath: ChildrenByPath = {}
  flattenTree(result.tree, nodesByPath, childrenByPath)

  return {
    rootPath: result.tree.path,
    nodesByPath,
    childrenByPath,
  }
}

export function computeExpandedPaths(args: {
  previousRootPath: string | null
  previousExpandedPaths: ExpandedPaths
  nextRootPath: string
  nextNodesByPath: NodesByPath
}) {
  const {
    previousRootPath,
    previousExpandedPaths,
    nextRootPath,
    nextNodesByPath,
  } = args

  const expandedPaths: ExpandedPaths = {
    [nextRootPath]: true,
  }

  if (previousRootPath !== nextRootPath) {
    return expandedPaths
  }

  for (const path of Object.keys(previousExpandedPaths)) {
    if (nextNodesByPath[path]?.type === "directory") {
      expandedPaths[path] = true
    }
  }

  return expandedPaths
}
