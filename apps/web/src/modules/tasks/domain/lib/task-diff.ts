export function extractDiffBlocks(text: string) {
  if (!text.trim()) {
    return []
  }

  const blocks: string[] = []

  const fencedDiff = /```diff\s*([\s\S]*?)```/g
  for (const match of text.matchAll(fencedDiff)) {
    const content = match[1]?.trim()
    if (content) {
      blocks.push(content)
    }
  }

  const lines = text.split(/\r?\n/)
  let currentBlock: string[] = []

  function flushCurrentBlock() {
    if (currentBlock.length === 0) {
      return
    }

    const merged = currentBlock.join("\n").trim()
    if (merged.length > 0) {
      blocks.push(merged)
    }

    currentBlock = []
  }

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      flushCurrentBlock()
      currentBlock.push(line)
      continue
    }

    if (currentBlock.length > 0) {
      currentBlock.push(line)
    }
  }

  flushCurrentBlock()

  return blocks
}

export function extractChangedFiles(diffBlocks: string[]) {
  const files = new Set<string>()

  for (const block of diffBlocks) {
    for (const line of block.split("\n")) {
      if (line.startsWith("diff --git ")) {
        const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/)
        if (match?.[2]) {
          files.add(match[2].trim())
        }
        continue
      }

      if (line.startsWith("+++ b/")) {
        files.add(line.slice("+++ b/".length).trim())
      }
    }
  }

  return Array.from(files)
}
