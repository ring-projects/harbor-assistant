type TomlPrimitive = string | number | boolean
type TomlValue = TomlPrimitive | TomlPrimitive[]

type ParsedTomlMcpServer = {
  command?: string
  url?: string
  args?: string[]
  enabled?: boolean
  env?: Record<string, string>
  headers?: Record<string, string>
}

type SectionState =
  | {
      kind: "none"
    }
  | {
      kind: "server"
      serverName: string
    }
  | {
      kind: "server-map"
      serverName: string
      mapKey: "env" | "headers"
    }

function stripInlineComment(line: string) {
  let inSingleQuote = false
  let inDoubleQuote = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const previous = index > 0 ? line[index - 1] : ""

    if (char === "'" && !inDoubleQuote && previous !== "\\") {
      inSingleQuote = !inSingleQuote
      continue
    }
    if (char === '"' && !inSingleQuote && previous !== "\\") {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (char === "#" && !inSingleQuote && !inDoubleQuote) {
      return line.slice(0, index)
    }
  }

  return line
}

function unquote(value: string) {
  const trimmed = value.trim()
  if (trimmed.length < 2) {
    return trimmed
  }

  const startsWithDouble = trimmed.startsWith('"') && trimmed.endsWith('"')
  const startsWithSingle = trimmed.startsWith("'") && trimmed.endsWith("'")
  if (!startsWithDouble && !startsWithSingle) {
    return trimmed
  }

  const inner = trimmed.slice(1, -1)
  return inner.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, "\\")
}

function splitTopLevelByComma(value: string) {
  const parts: string[] = []
  let current = ""
  let inSingleQuote = false
  let inDoubleQuote = false
  let bracketDepth = 0

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    const previous = index > 0 ? value[index - 1] : ""

    if (char === "'" && !inDoubleQuote && previous !== "\\") {
      inSingleQuote = !inSingleQuote
      current += char
      continue
    }
    if (char === '"' && !inSingleQuote && previous !== "\\") {
      inDoubleQuote = !inDoubleQuote
      current += char
      continue
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === "[") {
        bracketDepth += 1
      } else if (char === "]" && bracketDepth > 0) {
        bracketDepth -= 1
      } else if (char === "," && bracketDepth === 0) {
        parts.push(current.trim())
        current = ""
        continue
      }
    }

    current += char
  }

  if (current.trim()) {
    parts.push(current.trim())
  }

  return parts
}

function parseTomlValue(rawValue: string): TomlValue | undefined {
  const trimmed = rawValue.trim()
  if (!trimmed) {
    return undefined
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return unquote(trimmed)
  }

  if (trimmed === "true") {
    return true
  }
  if (trimmed === "false") {
    return false
  }

  const numeric = Number(trimmed)
  if (!Number.isNaN(numeric)) {
    return numeric
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim()
    if (!inner) {
      return []
    }

    const tokens = splitTopLevelByComma(inner)
    const parsed = tokens
      .map((token) => parseTomlValue(token))
      .filter((value) => value !== undefined)

    const flattened = parsed.filter(
      (value): value is TomlPrimitive => !Array.isArray(value),
    )
    return flattened
  }

  return trimmed
}

function parseSection(sectionRaw: string): SectionState {
  const section = sectionRaw.trim()

  const serverMapMatch = section.match(
    /^mcp_servers\.(?:"([^"]+)"|([A-Za-z0-9_-]+))\.(env|headers)$/,
  )
  if (serverMapMatch) {
    const [, quotedName, bareName, mapKey] = serverMapMatch
    const serverName = quotedName || bareName
    if (!serverName) {
      return { kind: "none" }
    }
    return {
      kind: "server-map",
      serverName,
      mapKey: mapKey as "env" | "headers",
    }
  }

  const serverMatch = section.match(
    /^mcp_servers\.(?:"([^"]+)"|([A-Za-z0-9_-]+))$/,
  )
  if (serverMatch) {
    const [, quotedName, bareName] = serverMatch
    const serverName = quotedName || bareName
    if (!serverName) {
      return { kind: "none" }
    }
    return {
      kind: "server",
      serverName,
    }
  }

  return { kind: "none" }
}

function ensureServer(
  serversByName: Map<string, ParsedTomlMcpServer>,
  serverName: string,
) {
  const existing = serversByName.get(serverName)
  if (existing) {
    return existing
  }

  const created: ParsedTomlMcpServer = {
    args: [],
    env: {},
    headers: {},
  }
  serversByName.set(serverName, created)
  return created
}

export function parseTomlMcpServers(content: string) {
  const lines = content.split(/\r?\n/)
  const serversByName = new Map<string, ParsedTomlMcpServer>()
  let currentSection: SectionState = { kind: "none" }

  for (const line of lines) {
    const normalized = stripInlineComment(line).trim()
    if (!normalized) {
      continue
    }

    if (normalized.startsWith("[") && normalized.endsWith("]")) {
      const sectionRaw = normalized.slice(1, -1)
      currentSection = parseSection(sectionRaw)
      continue
    }

    if (currentSection.kind === "none") {
      continue
    }

    const delimiterIndex = normalized.indexOf("=")
    if (delimiterIndex < 0) {
      continue
    }

    const key = normalized.slice(0, delimiterIndex).trim()
    const rawValue = normalized.slice(delimiterIndex + 1).trim()
    const value = parseTomlValue(rawValue)
    if (value === undefined) {
      continue
    }

    const targetServer = ensureServer(serversByName, currentSection.serverName)

    if (currentSection.kind === "server-map") {
      if (typeof value === "string") {
        if (currentSection.mapKey === "env") {
          targetServer.env = {
            ...(targetServer.env ?? {}),
            [key]: value,
          }
        } else {
          targetServer.headers = {
            ...(targetServer.headers ?? {}),
            [key]: value,
          }
        }
      }
      continue
    }

    if (key === "command" && typeof value === "string") {
      targetServer.command = value
      continue
    }

    if (key === "url" && typeof value === "string") {
      targetServer.url = value
      continue
    }

    if (key === "enabled" && typeof value === "boolean") {
      targetServer.enabled = value
      continue
    }

    if (key === "args" && Array.isArray(value)) {
      const stringValues = value.filter(
        (item): item is string => typeof item === "string",
      )
      targetServer.args = stringValues
    }
  }

  return serversByName
}
