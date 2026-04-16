"use client"

import { memo } from "react"

function TypingIndicatorView(props: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="bg-surface-subtle w-full rounded-lg p-2">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1">
            <span className="bg-muted-foreground/60 size-2 animate-bounce rounded-full [animation-delay:-0.3s]" />
            <span className="bg-muted-foreground/60 size-2 animate-bounce rounded-full [animation-delay:-0.15s]" />
            <span className="bg-muted-foreground/60 size-2 animate-bounce rounded-full" />
          </div>
          <span className="text-muted-foreground font-mono text-[11px] leading-5">
            {props.label}
          </span>
        </div>
      </div>
    </div>
  )
}

export const TypingIndicator = memo(TypingIndicatorView)
