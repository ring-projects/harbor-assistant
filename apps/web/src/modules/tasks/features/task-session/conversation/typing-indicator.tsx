"use client"

import { memo } from "react"

function TypingIndicatorView(props: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="w-full rounded-lg bg-muted/18 px-3 py-2">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1">
            <span className="size-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
            <span className="size-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
            <span className="size-2 animate-bounce rounded-full bg-slate-400" />
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
