export function normalizeCodeLanguage(language?: string | null) {
  if (!language) {
    return null
  }

  const normalized = language.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (normalized === "tsx" || normalized === "typescriptreact") {
    return "tsx"
  }

  if (normalized === "ts" || normalized === "typescript") {
    return "ts"
  }

  if (normalized === "jsx" || normalized === "javascriptreact") {
    return "jsx"
  }

  if (normalized === "js" || normalized === "javascript") {
    return "js"
  }

  if (normalized === "yml") {
    return "yaml"
  }

  if (normalized === "shell" || normalized === "zsh" || normalized === "sh") {
    return "bash"
  }

  return normalized
}

export function inferLanguageFromFilePath(filePath: string) {
  const normalized = filePath.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (normalized.endsWith(".tsx")) {
    return "tsx"
  }
  if (normalized.endsWith(".ts")) {
    return "ts"
  }
  if (normalized.endsWith(".jsx")) {
    return "jsx"
  }
  if (
    normalized.endsWith(".js") ||
    normalized.endsWith(".mjs") ||
    normalized.endsWith(".cjs")
  ) {
    return "js"
  }
  if (normalized.endsWith(".json")) {
    return "json"
  }
  if (normalized.endsWith(".md") || normalized.endsWith(".mdx")) {
    return "markdown"
  }
  if (normalized.endsWith(".css")) {
    return "css"
  }
  if (normalized.endsWith(".html")) {
    return "html"
  }
  if (normalized.endsWith(".yaml") || normalized.endsWith(".yml")) {
    return "yaml"
  }
  if (normalized.endsWith(".toml")) {
    return "toml"
  }
  if (normalized.endsWith(".sh") || normalized.endsWith(".zsh")) {
    return "bash"
  }
  if (normalized.endsWith(".py")) {
    return "python"
  }
  if (normalized.endsWith(".go")) {
    return "go"
  }
  if (normalized.endsWith(".rs")) {
    return "rust"
  }
  if (normalized.endsWith(".java")) {
    return "java"
  }

  return null
}
