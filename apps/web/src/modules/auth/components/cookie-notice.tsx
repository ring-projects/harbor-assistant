"use client"

import { Button } from "@/components/ui/button"

type CookieNoticeProps = {
  onDismiss: () => void
}

export function CookieNotice({ onDismiss }: CookieNoticeProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
      <div className="w-full border-t border-current/10 pt-5">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <p className="max-w-2xl text-sm leading-6 text-current/70">
            We use cookies to improve your experience, keep you signed in, and
            make Harbor work as expected.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={onDismiss}
            className="h-auto rounded-[4px] border-current/15 bg-transparent px-4 py-2 text-sm leading-6 font-medium text-current shadow-none hover:bg-current/8 hover:text-current sm:shrink-0"
          >
            Got it
          </Button>
        </div>
      </div>
    </div>
  )
}
