"use client"

import { FolderTreeIcon } from "lucide-react"

import { useFileExplorerBootstrap } from "@/components/file-explorer/hooks/use-file-explorer-bootstrap"
import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useUiStore } from "@/stores"
import { FileExplorer } from "./FileExplorer"

export function FileExplorerSheet() {
  const open = useUiStore((store) => store.fileExplorerSheetOpen)
  const openFileExplorerSheet = useUiStore((store) => store.openFileExplorerSheet)
  const setFileExplorerSheetOpen = useUiStore(
    (store) => store.setFileExplorerSheetOpen
  )
  useFileExplorerBootstrap(open)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={openFileExplorerSheet}
      >
        <FolderTreeIcon className="size-4" />
        <span className="hidden sm:inline">File Explorer</span>
        <Kbd className="ml-1 hidden sm:inline-flex">⌘K</Kbd>
      </Button>

      <Sheet open={open} onOpenChange={setFileExplorerSheetOpen}>
        <SheetContent
          side="right"
          className="!w-[min(100vw,1200px)] sm:!max-w-[1200px] gap-0 p-0"
        >
          <SheetHeader className="border-b">
            <SheetTitle>File Explorer</SheetTitle>
            <SheetDescription>
              Press{" "}
              <KbdGroup className="align-middle">
                <Kbd>⌘</Kbd>
                <span>+</span>
                <Kbd>K</Kbd>
              </KbdGroup>{" "}
              to open this panel.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            <FileExplorer />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
