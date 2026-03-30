"use client"

import { memo, useEffect, useMemo, useState } from "react"
import { codeToHtml } from "shiki/bundle/web"

import { normalizeCodeLanguage } from "./utils"

type ShikiCodeBlockProps = {
  code: string
  language?: string | null
}

const highlightedHtmlCache = new Map<string, Promise<string>>()

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function createFallbackHtml(code: string) {
  return `<pre class="shiki shiki-fallback" tabindex="0"><code>${escapeHtml(code)}</code></pre>`
}

async function highlightCode(code: string, language: string | null) {
  const normalizedLanguage = normalizeCodeLanguage(language) ?? "text"
  const cacheKey = `${normalizedLanguage}\u0000${code}`
  const cached = highlightedHtmlCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const pending = codeToHtml(code, {
    lang: normalizedLanguage,
    themes: {
      light: "github-light",
      dark: "github-dark",
    },
  }).catch((error) => {
    highlightedHtmlCache.delete(cacheKey)
    throw error
  })

  highlightedHtmlCache.set(cacheKey, pending)
  return pending
}

function ShikiCodeBlockView({ code, language }: ShikiCodeBlockProps) {
  const normalizedCode = useMemo(() => code.replace(/\n$/, ""), [code])
  const fallbackHtml = useMemo(
    () => createFallbackHtml(normalizedCode),
    [normalizedCode],
  )
  const highlightKey = useMemo(
    () => `${language ?? "text"}\u0000${normalizedCode}`,
    [language, normalizedCode],
  )
  const [htmlState, setHtmlState] = useState(() => ({
    key: highlightKey,
    html: fallbackHtml,
  }))
  const html = htmlState.key === highlightKey ? htmlState.html : fallbackHtml

  useEffect(() => {
    let disposed = false

    void highlightCode(normalizedCode, language ?? null)
      .then((nextHtml) => {
        if (!disposed) {
          setHtmlState({
            key: highlightKey,
            html: nextHtml,
          })
        }
      })
      .catch(() => {
        if (!disposed) {
          setHtmlState({
            key: highlightKey,
            html: fallbackHtml,
          })
        }
      })

    return () => {
      disposed = true
    }
  }, [fallbackHtml, highlightKey, language, normalizedCode])

  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

export const ShikiCodeBlock = memo(ShikiCodeBlockView)
