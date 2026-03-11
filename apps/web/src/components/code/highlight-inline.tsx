"use client"

import { Fragment, useMemo, type ReactNode } from "react"

import { normalizeCodeLanguage } from "./utils"

type HighlightedCodeTextProps = {
  code: string
  language?: string | null
}

type HighlightToken = {
  text: string
  className: string | null
}

const KEYWORD_SET = new Set([
  "as",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "return",
  "static",
  "switch",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "with",
  "yield",
])

function pushToken(tokens: HighlightToken[], text: string, className: string | null) {
  if (!text) {
    return
  }

  tokens.push({ text, className })
}

function tokenizeMarkup(code: string) {
  const tokens: HighlightToken[] = []
  const pattern = /(<\/?[\w:-]+)|(\s[\w:-]+)(=)|("[^"]*"|'[^']*')|<\/?>/g
  let cursor = 0

  for (const match of code.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) {
      pushToken(tokens, code.slice(cursor, index), null)
    }

    const [full, tagName, attributeName, equals, quotedValue] = match
    if (tagName) {
      pushToken(tokens, tagName, "tok-tagName")
    } else if (attributeName) {
      pushToken(tokens, attributeName, "tok-attributeName")
    } else if (equals) {
      pushToken(tokens, equals, "tok-operator")
    } else if (quotedValue) {
      pushToken(tokens, quotedValue, "tok-string")
    } else {
      pushToken(tokens, full, "tok-punctuation")
    }

    cursor = index + full.length
  }

  if (cursor < code.length) {
    pushToken(tokens, code.slice(cursor), null)
  }

  return tokens
}

function tokenizeCodeLike(code: string, language: string | null) {
  const tokens: HighlightToken[] = []
  const commentPattern =
    language === "python" ? /#.*/g : /\/\/.*|\/\*.*?\*\//g
  const stringPattern =
    /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g
  const numberPattern = /\b\d+(?:\.\d+)?\b/g
  const identifierPattern = /\b[A-Za-z_$][\w$]*\b/g

  const matches: Array<{ from: number; to: number; className: string }> = []

  for (const pattern of [commentPattern, stringPattern, numberPattern, identifierPattern]) {
    for (const match of code.matchAll(pattern)) {
      const text = match[0]
      const from = match.index ?? 0
      const to = from + text.length

      let className = "tok-variableName"
      if (pattern === commentPattern) {
        className = "tok-comment"
      } else if (pattern === stringPattern) {
        className = "tok-string"
      } else if (pattern === numberPattern) {
        className = "tok-number"
      } else if (KEYWORD_SET.has(text)) {
        className = "tok-keyword"
      } else if (/^[A-Z]/.test(text)) {
        className = "tok-typeName"
      }

      matches.push({ from, to, className })
    }
  }

  matches.sort((left, right) => left.from - right.from || left.to - right.to)

  let cursor = 0
  for (const match of matches) {
    if (match.from < cursor) {
      continue
    }

    if (match.from > cursor) {
      pushToken(tokens, code.slice(cursor, match.from), null)
    }

    pushToken(tokens, code.slice(match.from, match.to), match.className)
    cursor = match.to
  }

  if (cursor < code.length) {
    pushToken(tokens, code.slice(cursor), null)
  }

  if (tokens.length === 0) {
    return [{ text: code, className: null }]
  }

  return tokens
}

function tokenize(code: string, language: string | null) {
  if (!code) {
    return [{ text: "", className: null }]
  }

  const normalizedLanguage = normalizeCodeLanguage(language)
  if (!normalizedLanguage) {
    return [{ text: code, className: null }]
  }

  if (
    normalizedLanguage === "html" ||
    normalizedLanguage === "markdown"
  ) {
    return tokenizeMarkup(code)
  }

  return tokenizeCodeLike(code, normalizedLanguage)
}

export function HighlightedCodeText({
  code,
  language,
}: HighlightedCodeTextProps) {
  const tokens = useMemo(() => tokenize(code, language ?? null), [code, language])

  return (
    <>
      {tokens.map((token, index): ReactNode => {
        if (!token.text) {
          return null
        }

        if (!token.className) {
          return <Fragment key={index}>{token.text}</Fragment>
        }

        return (
          <span key={index} className={token.className}>
            {token.text}
          </span>
        )
      })}
    </>
  )
}
