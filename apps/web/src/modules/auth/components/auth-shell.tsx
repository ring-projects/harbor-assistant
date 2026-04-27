"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type AuthShellProps = {
  eyebrow?: string
  title: string
  description: string
  errorMessage?: string | null
  actions?: ReactNode
  className?: string
}

export function AuthShell({
  eyebrow = "Harbor Assistant",
  title,
  description,
  errorMessage,
  actions,
  className,
}: AuthShellProps) {
  return (
    <div className="bg-background text-foreground flex min-h-svh items-center justify-center p-6">
      <div
        className={cn(
          "bg-card w-full max-w-md rounded-2xl border p-6 shadow-sm",
          className,
        )}
      >
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">{eyebrow}</p>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-muted-foreground text-sm leading-6">
            {description}
          </p>
          {errorMessage ? (
            <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
              {errorMessage}
            </div>
          ) : null}
        </div>

        {actions ? <div className="mt-6 flex gap-3">{actions}</div> : null}
      </div>
    </div>
  )
}
