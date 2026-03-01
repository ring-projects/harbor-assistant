"use client"

import { useEffect, useMemo, useState } from "react"
import { RangeSetBuilder } from "@codemirror/state"
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language"
import { Decoration, EditorView } from "@codemirror/view"
import CodeMirror from "@uiw/react-codemirror"
import {
  HighlighterIcon,
  MessageSquarePlusIcon,
  Trash2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { getCodeMirrorLanguageExtension } from "./language-extension"
import { normalizeCodeLanguage } from "./utils"

type CodeAnnotation = {
  id: string
  startLine: number
  endLine: number
  comment: string
  selectedText: string
  createdAt: string
}

type SelectedRange = {
  startLine: number
  endLine: number
  selectedText: string
}

type InteractiveCodeBlockProps = {
  code: string
  sourceId: string
  language?: string | null
  className?: string
  showLineNumbers?: boolean
}

const ANNOTATION_STORAGE_KEY = "harbor_code_annotations_v1"

function loadAnnotationsBySourceId(sourceId: string) {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const raw = window.localStorage.getItem(ANNOTATION_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) {
      return []
    }

    const scoped = (parsed as Record<string, unknown>)[sourceId]
    if (!Array.isArray(scoped)) {
      return []
    }

    return scoped.filter(
      (item): item is CodeAnnotation =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        typeof item.id === "string" &&
        "startLine" in item &&
        typeof item.startLine === "number" &&
        "endLine" in item &&
        typeof item.endLine === "number" &&
        "comment" in item &&
        typeof item.comment === "string" &&
        "selectedText" in item &&
        typeof item.selectedText === "string" &&
        "createdAt" in item &&
        typeof item.createdAt === "string",
    )
  } catch {
    return []
  }
}

function saveAnnotationsBySourceId(
  sourceId: string,
  annotations: CodeAnnotation[],
) {
  if (typeof window === "undefined") {
    return
  }

  try {
    const raw = window.localStorage.getItem(ANNOTATION_STORAGE_KEY)
    const parsed =
      raw && raw.trim()
        ? (JSON.parse(raw) as Record<string, unknown>)
        : ({} as Record<string, unknown>)
    const next = {
      ...parsed,
      [sourceId]: annotations,
    }
    window.localStorage.setItem(ANNOTATION_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore localStorage write errors.
  }
}

function truncateSelectedText(selectedText: string) {
  const compacted = selectedText.replace(/\s+/g, " ").trim()
  if (compacted.length <= 160) {
    return compacted
  }

  return `${compacted.slice(0, 157)}...`
}

function createLineDecorationExtension(args: {
  selectedRange: SelectedRange | null
  annotations: CodeAnnotation[]
}) {
  const { selectedRange, annotations } = args

  return EditorView.decorations.of((view) => {
    const builder = new RangeSetBuilder<Decoration>()
    const classesByLine = new Map<number, Set<string>>()

    const applyClassToLine = (lineNumber: number, className: string) => {
      if (lineNumber < 1 || lineNumber > view.state.doc.lines) {
        return
      }

      const existing = classesByLine.get(lineNumber) ?? new Set<string>()
      existing.add(className)
      classesByLine.set(lineNumber, existing)
    }

    for (const annotation of annotations) {
      const startLine = Math.min(annotation.startLine, annotation.endLine)
      const endLine = Math.max(annotation.startLine, annotation.endLine)
      for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
        applyClassToLine(lineNumber, "cm-annotation-line")
      }
    }

    if (selectedRange) {
      const startLine = Math.min(selectedRange.startLine, selectedRange.endLine)
      const endLine = Math.max(selectedRange.startLine, selectedRange.endLine)
      for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
        applyClassToLine(lineNumber, "cm-selected-line")
      }
    }

    for (const [lineNumber, classNames] of classesByLine.entries()) {
      const line = view.state.doc.line(lineNumber)
      builder.add(
        line.from,
        line.from,
        Decoration.line({
          attributes: {
            class: Array.from(classNames.values()).join(" "),
          },
        }),
      )
    }

    return builder.finish()
  })
}

const editorTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
  },
  ".cm-scroller": {
    fontFamily:
      "var(--font-mono), var(--font-mono-geist), ui-monospace, SFMono-Regular, Menlo, monospace",
    lineHeight: "1.4",
  },
  ".cm-content": {
    padding: "4px 0",
  },
  ".cm-line": {
    padding: "0 8px",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "1px solid hsl(var(--border))",
    color: "hsl(var(--muted-foreground))",
    fontSize: "11px",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
  ".cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "hsl(var(--primary) / 0.2) !important",
  },
  ".cm-annotation-line": {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  ".cm-selected-line": {
    backgroundColor: "rgba(14, 165, 233, 0.12)",
  },
})

export function InteractiveCodeBlock(props: InteractiveCodeBlockProps) {
  const { code, sourceId, language, className, showLineNumbers = true } = props

  const normalizedLanguage = normalizeCodeLanguage(language)
  const lineCount = useMemo(() => code.split(/\r?\n/).length, [code])

  const [annotations, setAnnotations] = useState<CodeAnnotation[]>(() =>
    loadAnnotationsBySourceId(sourceId),
  )
  const [selectedRange, setSelectedRange] = useState<SelectedRange | null>(null)
  const [draftComment, setDraftComment] = useState("")
  const [isComposerOpen, setIsComposerOpen] = useState(false)

  const languageExtension = useMemo(
    () => getCodeMirrorLanguageExtension(normalizedLanguage),
    [normalizedLanguage],
  )

  const lineDecorationExtension = useMemo(
    () =>
      createLineDecorationExtension({
        selectedRange,
        annotations,
      }),
    [annotations, selectedRange],
  )

  const editorExtensions = useMemo(
    () => [
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      editorTheme,
      lineDecorationExtension,
      ...(languageExtension ? [languageExtension] : []),
    ],
    [languageExtension, lineDecorationExtension],
  )

  useEffect(() => {
    saveAnnotationsBySourceId(sourceId, annotations)
  }, [annotations, sourceId])

  function saveAnnotation() {
    if (!selectedRange) {
      return
    }

    const trimmedComment = draftComment.trim()
    if (!trimmedComment) {
      return
    }

    const annotation: CodeAnnotation = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      startLine: Math.min(selectedRange.startLine, selectedRange.endLine),
      endLine: Math.max(selectedRange.startLine, selectedRange.endLine),
      comment: trimmedComment,
      selectedText: selectedRange.selectedText,
      createdAt: new Date().toISOString(),
    }

    setAnnotations((previous) =>
      [...previous, annotation].sort(
        (first, second) => first.startLine - second.startLine,
      ),
    )
    setSelectedRange(null)
    setDraftComment("")
    setIsComposerOpen(false)
  }

  function removeAnnotation(annotationId: string) {
    setAnnotations((previous) =>
      previous.filter((annotation) => annotation.id !== annotationId),
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="border-border bg-muted/40 rounded-md border">
        <div className="border-border flex items-center gap-2 border-b px-2 py-1.5">
          <HighlighterIcon className="text-muted-foreground size-3.5" />
          <span className="text-muted-foreground text-[11px]">
            {normalizedLanguage ? normalizedLanguage : "text"}
          </span>
          <span className="text-muted-foreground ml-auto text-[11px]">
            {lineCount} lines
          </span>
        </div>

        <CodeMirror
          value={code}
          theme="light"
          editable={false}
          readOnly
          basicSetup={{
            lineNumbers: showLineNumbers,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            dropCursor: false,
            searchKeymap: false,
            defaultKeymap: false,
            history: false,
          }}
          extensions={editorExtensions}
          onUpdate={(update) => {
            if (!update.selectionSet) {
              return
            }

            const selection = update.state.selection.main
            if (selection.empty) {
              setSelectedRange((previous) => (previous ? null : previous))
              setIsComposerOpen(false)
              return
            }

            const rawText = update.state.sliceDoc(selection.from, selection.to)
            const selectedText = rawText.trim()
            if (!selectedText) {
              setSelectedRange((previous) => (previous ? null : previous))
              setIsComposerOpen(false)
              return
            }

            const from = Math.min(selection.from, selection.to)
            const to = Math.max(selection.from, selection.to)
            const startLine = update.state.doc.lineAt(from).number
            const endLine = update.state.doc.lineAt(
              Math.max(from, to - 1),
            ).number

            const nextRange = {
              startLine,
              endLine,
              selectedText: truncateSelectedText(rawText),
            }

            setSelectedRange((previous) => {
              if (
                previous &&
                previous.startLine === nextRange.startLine &&
                previous.endLine === nextRange.endLine &&
                previous.selectedText === nextRange.selectedText
              ) {
                return previous
              }

              return nextRange
            })
          }}
          className="text-xs"
        />
      </div>

      {selectedRange ? (
        <div className="space-y-2 rounded-md border border-sky-500/30 bg-sky-500/10 p-2">
          <div className="text-xs">
            Selected lines:{" "}
            <span className="font-medium">{selectedRange.startLine}</span> -{" "}
            <span className="font-medium">{selectedRange.endLine}</span>
          </div>
          <p className="text-muted-foreground font-mono text-xs">
            {selectedRange.selectedText}
          </p>
          {!isComposerOpen ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => setIsComposerOpen(true)}
            >
              <MessageSquarePlusIcon className="size-3.5" />
              Add Annotation
            </Button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={draftComment}
                onChange={(event) => setDraftComment(event.target.value)}
                placeholder="Add your note for this selection..."
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-20 w-full rounded-md border bg-transparent px-2 py-1.5 text-xs outline-none focus-visible:ring-[3px]"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="xs"
                  onClick={saveAnnotation}
                  disabled={!draftComment.trim()}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setIsComposerOpen(false)
                    setDraftComment("")
                    setSelectedRange(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {annotations.length > 0 ? (
        <div className="space-y-2 rounded-md border p-2">
          <p className="text-muted-foreground text-xs font-medium">
            Annotations
          </p>
          <ul className="space-y-2">
            {annotations.map((annotation) => (
              <li
                key={annotation.id}
                className="bg-muted/40 rounded-md border p-2"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-medium">
                    L{annotation.startLine}
                    {annotation.endLine !== annotation.startLine
                      ? `-L${annotation.endLine}`
                      : ""}
                  </span>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => removeAnnotation(annotation.id)}
                    aria-label="Delete annotation"
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
                <p className="text-xs">{annotation.comment}</p>
                <p className="text-muted-foreground mt-1 font-mono text-[11px]">
                  {annotation.selectedText}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
