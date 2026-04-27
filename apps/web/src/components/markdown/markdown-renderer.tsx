"use client"

import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { createMathPlugin } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"
import { memo, type ComponentProps, useEffect, useRef } from "react"
import { Streamdown } from "streamdown"

import { cn } from "@/lib/utils"

import styles from "./markdown-renderer.module.css"

type MarkdownRendererProps = {
  content: string
  className?: string
  compact?: boolean
  isStreaming?: boolean
}

const streamdownComponents = {
  a: function MarkdownLink(props: ComponentProps<"a">) {
    return <a {...props} target="_blank" rel="noreferrer" />
  },
}

const streamdownControls = {
  code: {
    copy: true,
    download: false,
  },
  mermaid: {
    copy: false,
    download: false,
    fullscreen: false,
    panZoom: false,
  },
  table: {
    copy: true,
    download: true,
    fullscreen: true,
  },
} as const

const math = createMathPlugin({
  errorColor: "var(--muted-foreground)",
  singleDollarTextMath: true,
})

const mermaidOptions = {
  config: {
    flowchart: {
      htmlLabels: false,
      nodeSpacing: 32,
      rankSpacing: 48,
      useMaxWidth: true,
    },
    fontFamily:
      "var(--font-mono), var(--font-mono-geist), ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 16,
    theme: "base",
    themeVariables: {
      background: "transparent",
      lineColor: "var(--muted-foreground)",
      mainBkg: "var(--card)",
      nodeBorder: "var(--border)",
      primaryBorderColor: "var(--border)",
      primaryColor: "var(--card)",
      primaryTextColor: "var(--foreground)",
      secondaryColor: "var(--secondary)",
      tertiaryColor: "var(--muted)",
    },
  },
} as const

const streamdownPlugins = {
  cjk,
  code,
  math,
  mermaid,
} as const

function MarkdownRendererView({
  content,
  className,
  compact = false,
  isStreaming = false,
}: MarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const handleWheelCapture = (event: WheelEvent) => {
      const target = event.target

      if (!(target instanceof Element)) {
        return
      }

      if (target.closest('[data-streamdown="mermaid"]')) {
        event.stopPropagation()
      }
    }

    container.addEventListener("wheel", handleWheelCapture, { capture: true })

    return () => {
      container.removeEventListener("wheel", handleWheelCapture, {
        capture: true,
      })
    }
  }, [])

  return (
    <div ref={containerRef}>
      <Streamdown
        className={cn(
          styles["markdown-body"],
          compact && styles.compact,
          "space-y-2 [&_a]:underline [&_a]:underline-offset-2 [&_h1]:text-lg [&_h2]:text-base [&_h2]:font-semibold [&_li]:leading-7 [&_ol]:space-y-1 [&_ol]:pl-5 [&_p]:leading-7 [&_table]:w-full [&_table]:border-collapse [&_ul]:space-y-1 [&_ul]:pl-5",
          className,
        )}
        components={streamdownComponents}
        controls={streamdownControls}
        isAnimating={isStreaming}
        lineNumbers={false}
        mermaid={mermaidOptions}
        mode={isStreaming ? "streaming" : "static"}
        parseIncompleteMarkdown
        plugins={streamdownPlugins}
        skipHtml
      >
        {content}
      </Streamdown>
    </div>
  )
}

export const MarkdownRenderer = memo(MarkdownRendererView)
