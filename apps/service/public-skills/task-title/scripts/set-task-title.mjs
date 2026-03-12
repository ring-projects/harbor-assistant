#!/usr/bin/env node

const title = process.argv.slice(2).join(" ").trim()
const baseUrl = process.env.HARBOR_SERVICE_BASE_URL?.trim()
const taskId = process.env.HARBOR_TASK_ID?.trim()

if (!title) {
  console.error("Usage: node scripts/set-task-title.mjs \"Short task title\"")
  process.exit(1)
}

if (!baseUrl || !taskId) {
  console.error("Missing Harbor task context. Expected HARBOR_SERVICE_BASE_URL and HARBOR_TASK_ID.")
  process.exit(1)
}

const response = await fetch(
  `${baseUrl}/tasks/${encodeURIComponent(taskId)}/title`,
  {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title,
      source: "agent",
    }),
  },
)

const payload = await response.json().catch(() => null)

if (!response.ok || payload?.ok === false) {
  const message =
    payload?.error?.message ??
    `Failed to update task title (status ${response.status}).`
  console.error(message)
  process.exit(1)
}

console.log(`Updated Harbor task title: ${title}`)
