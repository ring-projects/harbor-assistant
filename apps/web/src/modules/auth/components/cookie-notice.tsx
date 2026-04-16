"use client"

import { Button } from "@/components/ui/button"

type CookieNoticeProps = {
  onDismiss: () => void
}

export function CookieNotice({ onDismiss }: CookieNoticeProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
      <div className="border-border/80 w-full border-t pt-5">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <p className="text-muted-foreground max-w-2xl text-sm leading-6">
            We use cookies to improve your experience, keep you signed in, and
            make Harbor work as expected.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={onDismiss}
            className="border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground h-auto rounded-[4px] bg-transparent px-4 py-2 text-sm font-medium leading-6 shadow-none sm:shrink-0"
          >
            Got it
          </Button>
        </div>
      </div>
    </div>
  )
}
