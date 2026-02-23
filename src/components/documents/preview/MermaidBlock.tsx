"use client"

import mermaid from "mermaid"
import { useEffect, useId, useState } from "react"

let mermaidInitialized = false

function ensureMermaidInitialized() {
  if (mermaidInitialized) {
    return
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
  })
  mermaidInitialized = true
}

type MermaidBlockProps = {
  chart: string
}

export function MermaidBlock(props: MermaidBlockProps) {
  const { chart } = props
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const renderId = useId().replace(/:/g, "-")

  useEffect(() => {
    let cancelled = false

    const render = async () => {
      try {
        ensureMermaidInitialized()
        const rendered = await mermaid.render(renderId, chart)
        if (cancelled) {
          return
        }
        setSvg(rendered.svg)
        setError(null)
      } catch (cause) {
        if (cancelled) {
          return
        }
        setSvg(null)
        setError(
          cause instanceof Error
            ? cause.message
            : "Failed to render mermaid chart.",
        )
      }
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [chart, renderId])

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-destructive text-xs font-medium">
          Mermaid render error
        </p>
        <pre className="bg-muted overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap">
          {chart}
        </pre>
        <p className="text-muted-foreground text-xs">{error}</p>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="text-muted-foreground rounded-md border p-3 text-sm">
        Rendering mermaid chart...
      </div>
    )
  }

  return (
    <div
      className="bg-background overflow-auto rounded-md border p-3"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
