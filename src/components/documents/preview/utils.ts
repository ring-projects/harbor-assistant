export function getCodeLanguage(className?: string) {
  if (!className) {
    return null
  }

  const tokens = className.split(/\s+/).filter(Boolean)
  const languageToken = tokens.find((token) => token.startsWith("language-"))
  if (!languageToken) {
    return null
  }

  return languageToken.slice("language-".length).toLowerCase()
}

export function trimTrailingNewLine(value: string) {
  return value.endsWith("\n") ? value.slice(0, -1) : value
}
