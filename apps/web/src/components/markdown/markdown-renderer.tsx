"use client"

import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { createMathPlugin } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"
import { memo, type ComponentProps } from "react"
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
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontSize: 16,
    theme: "base",
    themeVariables: {
      background: "transparent",
      lineColor: "#94a3b8",
      mainBkg: "#ffffff",
      nodeBorder: "#cbd5e1",
      primaryBorderColor: "#cbd5e1",
      primaryColor: "#ffffff",
      primaryTextColor: "#0f172a",
      secondaryColor: "#f8fafc",
      tertiaryColor: "#ffffff",
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
  return (
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
  )
}

export const MarkdownRenderer = memo(MarkdownRendererView)
