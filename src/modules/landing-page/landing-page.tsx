"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LandingHeader } from "@/modules/landing-page/components/landing-header"

export function LandingPage() {
  const [isCompact, setIsCompact] = useState(false)

  function handleCreateClick() {
    setIsCompact(true)
  }

  return (
    <div className="bg-background text-foreground min-h-full">
      <div className="mx-auto w-full max-w-5xl px-6 md:px-8">
        <LandingHeader compact={isCompact} />

        <main
          className={cn(
            "space-y-14 overflow-hidden pb-20 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:space-y-18 md:pb-24",
            isCompact ? "max-h-0 opacity-0 pt-0" : "max-h-450 pt-0 opacity-100",
          )}
          aria-hidden={isCompact}
        >
          <section aria-labelledby="landing-heading" className="space-y-7">
            <div className="max-w-3xl space-y-5">
              <h1
                id="landing-heading"
                className="text-balance text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl"
              >
                Manage Multiple Agent Coding Tasks.
              </h1>
              <p className="text-muted-foreground max-w-[56ch] text-base leading-7 sm:text-lg">
                A lightweight CLI & web orchestration tool. Automatically
                assigns coding tasks to different AI agents and tracks execution
                progress in real time.
              </p>
            </div>
            <Button
              className="h-11 px-6 text-sm font-semibold"
              onClick={handleCreateClick}
              disabled={isCompact}
            >
              Get Started
            </Button>
          </section>

          <section className="overflow-hidden rounded-lg border">
            <header className="bg-background flex items-center justify-between border-b px-4 py-3 md:px-5">
              <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.05em] uppercase">
                Active Tasks
              </h2>
            </header>

            <ul className="py-1">
              <li className="grid grid-cols-[100px_1fr_80px] items-center border-b px-4 py-4 text-sm md:px-5 max-sm:grid-cols-2 max-sm:gap-y-2">
                <span className="text-muted-foreground font-mono text-xs max-sm:hidden">
                  #T-892
                </span>
                <span className="min-w-0 truncate">Refactor API auth middleware</span>
                <span className="justify-self-end text-xs font-semibold text-[#2563eb]">
                  Running
                </span>
              </li>
              <li className="grid grid-cols-[100px_1fr_80px] items-center border-b px-4 py-4 text-sm md:px-5 max-sm:grid-cols-2 max-sm:gap-y-2">
                <span className="text-muted-foreground font-mono text-xs max-sm:hidden">
                  #T-891
                </span>
                <span className="min-w-0 truncate">Fix CSS Grid spacing issue</span>
                <span className="justify-self-end text-xs font-semibold text-[#2563eb]">
                  Running
                </span>
              </li>
              <li className="grid grid-cols-[100px_1fr_80px] items-center px-4 py-4 text-sm md:px-5 max-sm:grid-cols-2 max-sm:gap-y-2">
                <span className="text-muted-foreground font-mono text-xs max-sm:hidden">
                  #T-890
                </span>
                <span className="min-w-0 truncate">
                  Write unit tests for user center
                </span>
                <span className="text-muted-foreground justify-self-end text-xs font-semibold">
                  Completed
                </span>
              </li>
            </ul>
          </section>

          <section
            aria-label="Core Features"
            className="grid grid-cols-1 gap-8 pt-2 md:grid-cols-3 md:gap-12"
          >
            <article className="space-y-3">
              <h3 className="text-base font-bold">Parallel Task Execution</h3>
              <p className="text-muted-foreground text-sm leading-6">
                Run multiple independent agents in parallel without interference
                to shorten development cycles.
              </p>
            </article>
            <article className="space-y-3">
              <h3 className="text-base font-bold">Context Management</h3>
              <p className="text-muted-foreground text-sm leading-6">
                Automatically extracts project-relevant code and gives each task
                the most precise prompt context.
              </p>
            </article>
            <article className="space-y-3">
              <h3 className="text-base font-bold">Lightweight Architecture</h3>
              <p className="text-muted-foreground text-sm leading-6">
                No database & no complex setup. Launch your agent fleet with a
                single config file.
              </p>
            </article>
          </section>
        </main>
      </div>
    </div>
  )
}
