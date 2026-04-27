#!/usr/bin/env node

import { spawn } from "node:child_process"

const title = process.argv.slice(2).join(" ").trim()
const taskId = process.env.HARBOR_TASK_ID?.trim()
const harborCli = process.env.HARBOR_CLI?.trim() || "harbor"

if (!title) {
  console.error('Usage: node scripts/set-task-title.mjs "Short task title"')
  process.exit(1)
}

if (!taskId) {
  console.error("Missing Harbor task context. Expected HARBOR_TASK_ID.")
  process.exit(1)
}

const child = spawn(
  harborCli,
  ["task", "title", "set", "--id", taskId, "--title", title],
  {
    stdio: "inherit",
    env: process.env,
  },
)

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Harbor CLI exited with signal ${signal}.`)
    process.exit(1)
  }

  process.exit(code ?? 1)
})

child.on("error", (error) => {
  console.error(
    `Failed to start Harbor CLI (${harborCli}): ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exit(1)
})
