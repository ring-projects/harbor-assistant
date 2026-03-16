"use client"

import { useEffect, useMemo, useState } from "react"
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

export function ShikiCodeBlock({ code, language }: ShikiCodeBlockProps) {
  const normalizedCode = useMemo(() => code.replace(/\n$/, ""), [code])
  const [html, setHtml] = useState(() => createFallbackHtml(normalizedCode))

  useEffect(() => {
    let disposed = false

    setHtml(createFallbackHtml(normalizedCode))

    void highlightCode(normalizedCode, language ?? null)
      .then((nextHtml) => {
        if (!disposed) {
          setHtml(nextHtml)
        }
      })
      .catch(() => {
        if (!disposed) {
          setHtml(createFallbackHtml(normalizedCode))
        }
      })

    return () => {
      disposed = true
    }
  }, [language, normalizedCode])

  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
