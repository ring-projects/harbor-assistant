"use client"

import { CopyIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

import type { ChatConversationBlock } from "../types"
import { formatChatTimestamp } from "./shared"

type ChatExecutionDrawerProps = {
  block: Extract<ChatConversationBlock, { type: "execution" }> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

async function copyText(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return
  }

  await navigator.clipboard.writeText(value)
}

export function ChatExecutionDrawer({
  block,
  open,
  onOpenChange,
}: ChatExecutionDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="data-[vaul-drawer-direction=right]:w-[420px] data-[vaul-drawer-direction=right]:max-w-[min(92vw,420px)]">
        <div className="flex h-full min-h-0 flex-col">
          <DrawerHeader className="border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DrawerTitle className="flex items-center gap-2">
                  <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium">
                    {block?.label ?? "Execution"}
                  </span>
                  {block?.source ? (
                    <span className="text-muted-foreground truncate text-xs font-normal">
                      {block.source}
                    </span>
                  ) : null}
                </DrawerTitle>
                <DrawerDescription className="mt-1">
                  {block ? formatChatTimestamp(block.timestamp) : ""}
                </DrawerDescription>
              </div>

              <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <XIcon className="size-4" />
                <span className="sr-only">Close drawer</span>
              </Button>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            <pre className="min-h-full overflow-x-auto whitespace-pre-wrap break-words rounded-xl border bg-muted/30 p-4 text-xs leading-6">
              {block?.content ?? ""}
            </pre>
          </div>

          <div className="flex items-center justify-end border-t p-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!block) {
                  return
                }

                void copyText(block.content)
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
