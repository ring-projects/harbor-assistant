"use client"

export function TypingIndicator(props: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-md border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="size-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
            <span className="size-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
            <span className="size-2 animate-bounce rounded-full bg-slate-400" />
          </div>
          <span className="text-muted-foreground text-xs">{props.label}</span>
        </div>
      </div>
    </div>
  )
}
