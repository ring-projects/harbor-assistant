"use client"

import type { ReactNode } from "react"
import {
  CheckCircle2Icon,
  CopyIcon,
  LoaderCircleIcon,
  SearchIcon,
  TerminalSquareIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { formatTimeShort } from "@/lib/date-time"
import { cn } from "@/lib/utils"

import type { ChatInspectorBlock } from "@/modules/tasks/view-models"

type ChatDetailDrawerProps = {
  block: ChatInspectorBlock | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type DetailSectionProps = {
  label: string
  children: ReactNode
}

function DetailSection({ label, children }: DetailSectionProps) {
  return (
    <section className="space-y-2">
      <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.12em]">
        {label}
      </p>
      {children}
    </section>
  )
}

function stringifyPretty(value: unknown) {
  if (typeof value === "string") {
    return value
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function getDrawerMeta(block: ChatInspectorBlock | null) {
  if (!block) {
    return {
      badge: "Details",
      title: "",
      subtitle: "",
    }
  }

  if (block.type === "file-change") {
    return {
      badge: "File Changes",
      title: block.changeId ?? "Patch",
      subtitle: `${block.changes.length} file${block.changes.length === 1 ? "" : "s"} changed`,
    }
  }

  if (block.type === "web-search") {
    return {
      badge: "Web Search",
      title: block.query,
      subtitle: block.searchId ?? "",
    }
  }

  if (block.type === "command-group") {
    return {
      badge: "Command",
      title: block.command,
      subtitle: block.commandId,
    }
  }

  return {
    badge: "MCP Tool",
    title:
      block.server && block.tool
        ? `${block.server}.${block.tool}`
        : block.tool ?? block.server ?? "Tool Call",
    subtitle: block.callId ?? "",
  }
}

function getCopyText(block: ChatInspectorBlock | null) {
  if (!block) {
    return ""
  }

  if (block.type === "file-change") {
    const lines = block.changes.map((change) => `${change.kind} ${change.path}`)
    return [block.changeId, ...lines].filter(Boolean).join("\n")
  }

  if (block.type === "web-search") {
    return block.query
  }

  if (block.type === "command-group") {
    const sections = [
      `command:\n${block.command}`,
      `status: ${block.status}`,
      block.exitCode === null ? null : `exit code: ${block.exitCode}`,
      block.output.trim() ? `output:\n${block.output}` : null,
    ]

    return sections.filter(Boolean).join("\n\n")
  }

  const sections = [
    block.server && block.tool ? `${block.server}.${block.tool}` : null,
    `arguments:\n${block.argumentsText}`,
    block.resultText ? `result:\n${block.resultText}` : null,
    block.errorText ? `error:\n${block.errorText}` : null,
  ]

  return sections.filter(Boolean).join("\n\n")
}

async function copyText(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard || !value) {
    return
  }

  await navigator.clipboard.writeText(value)
}

function renderDrawerBody(block: ChatInspectorBlock | null) {
  if (!block) {
    return null
  }

  if (block.type === "file-change") {
    return (
      <div className="space-y-5">
        <DetailSection label="Status">
          <span
            className={cn(
              "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
              block.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700",
            )}
          >
            {block.status === "success" ? "Applied" : "Failed"}
          </span>
        </DetailSection>

        <DetailSection label="Changes">
          <div className="space-y-2">
            {block.changes.map((change) => (
              <div
                key={`${change.kind}-${change.path}`}
                className="flex items-center gap-2 rounded-xl border bg-muted/25 px-3 py-2"
              >
                <span className="inline-flex min-w-14 justify-center rounded-full border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
                  {change.kind}
                </span>
                <span className="font-mono text-xs break-all">{change.path}</span>
              </div>
            ))}
          </div>
        </DetailSection>

        <DetailSection label="Raw Payload">
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border bg-muted/25 p-4 text-xs leading-6">
            {stringifyPretty(block.event.payload)}
          </pre>
        </DetailSection>
      </div>
    )
  }

  if (block.type === "web-search") {
    return (
      <div className="space-y-5">
        <DetailSection label="Status">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
              block.status === "completed"
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : "border-amber-200 bg-amber-50 text-amber-700",
            )}
          >
            <SearchIcon className="size-3.5" />
            {block.status === "completed" ? "Completed" : "Running"}
          </span>
        </DetailSection>

        <DetailSection label="Query">
          <div className="rounded-xl border bg-muted/25 px-4 py-3 text-sm leading-6">
            {block.query}
          </div>
        </DetailSection>

        <DetailSection label="Raw Payload">
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border bg-muted/25 p-4 text-xs leading-6">
            {stringifyPretty(block.event.payload)}
          </pre>
        </DetailSection>
      </div>
    )
  }

  if (block.type === "command-group") {
    const statusMeta =
      block.status === "success"
        ? {
            label: block.exitCode === null ? "Completed" : `Completed (exit ${block.exitCode})`,
            className: "border-emerald-200 bg-emerald-50 text-emerald-700",
            icon: CheckCircle2Icon,
            iconClassName: "text-emerald-700",
          }
        : block.status === "failed"
          ? {
              label: block.exitCode === null ? "Failed" : `Failed (exit ${block.exitCode})`,
              className: "border-rose-200 bg-rose-50 text-rose-700",
              icon: XCircleIcon,
              iconClassName: "text-rose-700",
            }
          : {
              label: "Running",
              className: "border-sky-200 bg-sky-50 text-sky-700",
              icon: LoaderCircleIcon,
              iconClassName: "animate-spin text-sky-700",
            }
    const StatusIcon = statusMeta.icon

    return (
      <div className="space-y-5">
        <DetailSection label="Status">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
              statusMeta.className,
            )}
          >
            <StatusIcon className={cn("size-3.5", statusMeta.iconClassName)} />
            {statusMeta.label}
          </span>
        </DetailSection>

        <DetailSection label="Command">
          <div className="rounded-xl border bg-muted/25 p-4">
            <div className="flex items-start gap-2">
              <TerminalSquareIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <code className="block whitespace-pre-wrap break-words font-mono text-xs leading-6">
                {block.command}
              </code>
            </div>
          </div>
        </DetailSection>

        <DetailSection label="Timeline">
          <div className="space-y-2 rounded-xl border bg-muted/25 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Started</span>
              <span>{formatTimeShort(block.startedAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Completed</span>
              <span>{block.completedAt ? formatTimeShort(block.completedAt) : "Pending"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Output</span>
              <span>{block.output.trim() ? `${block.output.trim().split(/\r?\n/).length} lines` : "No output"}</span>
            </div>
          </div>
        </DetailSection>

        <DetailSection label="Output">
          {block.output.trim() ? (
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border bg-muted/25 p-4 text-xs leading-6">
              {block.output}
            </pre>
          ) : (
            <div className="text-muted-foreground rounded-xl border bg-muted/25 px-4 py-3 text-sm">
              No output captured yet.
            </div>
          )}
        </DetailSection>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <DetailSection label="Status">
        <span
          className={cn(
            "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
            block.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : block.status === "failed"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-sky-200 bg-sky-50 text-sky-700",
          )}
        >
          {block.status === "running"
            ? "Running"
            : block.status === "success"
              ? "Completed"
              : "Failed"}
        </span>
      </DetailSection>

      <DetailSection label="Arguments">
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border bg-muted/25 p-4 text-xs leading-6">
          {block.argumentsText}
        </pre>
      </DetailSection>

      {block.resultText ? (
        <DetailSection label="Result">
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border bg-muted/25 p-4 text-xs leading-6">
            {block.resultText}
          </pre>
        </DetailSection>
      ) : null}

      {block.errorText ? (
        <DetailSection label="Error">
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs leading-6 text-rose-700">
            {block.errorText}
          </pre>
        </DetailSection>
      ) : null}
    </div>
  )
}

export function ChatDetailDrawer({
  block,
  open,
  onOpenChange,
}: ChatDetailDrawerProps) {
  const meta = getDrawerMeta(block)

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="data-[vaul-drawer-direction=right]:w-[460px] data-[vaul-drawer-direction=right]:max-w-[min(92vw,460px)]">
        <div className="flex h-full min-h-0 flex-col">
          <DrawerHeader className="border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DrawerTitle className="space-y-2">
                  <span className="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium">
                    {meta.badge}
                  </span>
                  <div className="text-base leading-6 break-words">
                    {meta.title}
                  </div>
                </DrawerTitle>
                <DrawerDescription className="mt-1">
                  {[meta.subtitle, block ? formatTimeShort(block.timestamp) : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </DrawerDescription>
              </div>

              <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <XIcon className="size-4" />
                <span className="sr-only">Close drawer</span>
              </Button>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            {renderDrawerBody(block)}
          </div>

          <div className="flex items-center justify-end border-t p-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void copyText(getCopyText(block))
              }}
              disabled={!block}
            >
              <CopyIcon className="size-4" />
              Copy
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
