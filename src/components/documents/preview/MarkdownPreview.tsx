"use client"

import ReactMarkdown from "react-markdown"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import remarkGfm from "remark-gfm"

import { InteractiveCodeBlock } from "@/components/code"
import { cn } from "@/lib/utils"
import { MermaidBlock } from "./MermaidBlock"
import { getCodeLanguage, trimTrailingNewLine } from "./utils"

const markdownSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ["className"]],
  },
}

type MarkdownPreviewProps = {
  content: string
  className?: string
  sourceId?: string
}

export function MarkdownPreview(props: MarkdownPreviewProps) {
  const { content, className, sourceId } = props

  return (
    <div className={cn("space-y-4", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, markdownSanitizeSchema]]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-6 mb-3 text-3xl font-semibold first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-6 mb-2 text-2xl font-semibold first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-5 mb-2 text-xl font-semibold first:mt-0">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-foreground/90 leading-7">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-7">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 pl-4 italic">{children}</blockquote>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-4"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/60 border-b">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border px-3 py-2 text-left font-medium">{children}</th>
          ),
          td: ({ children }) => <td className="border px-3 py-2 align-top">{children}</td>,
          pre: ({ children }) => <>{children}</>,
          code: ({ className: codeClassName, children, node }) => {
            const language = getCodeLanguage(codeClassName)
            const codeValue = trimTrailingNewLine(String(children ?? ""))

            const isMultiline = codeValue.includes("\n")
            if (isMultiline || language) {
              const blockOffset =
                typeof node?.position?.start?.offset === "number"
                  ? node.position.start.offset
                  : null
              const blockId = `${sourceId ?? "markdown-preview"}:code-block:${blockOffset ?? "unknown"}`

              if (language === "mermaid") {
                return <MermaidBlock chart={codeValue} />
              }

              return (
                <InteractiveCodeBlock
                  key={blockId}
                  code={codeValue}
                  language={language}
                  sourceId={blockId}
                />
              )
            }

            return (
              <code
                className={cn(
                  "bg-muted rounded px-1.5 py-0.5 font-mono text-xs",
                  codeClassName
                )}
              >
                {children}
              </code>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
