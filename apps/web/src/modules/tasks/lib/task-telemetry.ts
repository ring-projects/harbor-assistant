const TASK_TELEMETRY_EVENTS = [
  "task_create_submitted",
  "task_create_succeeded",
  "task_create_failed",
  "task_detail_opened",
  "task_log_stream_connected",
  "task_log_stream_disconnected",
  "task_cancel_clicked",
  "task_cancel_succeeded",
  "task_cancel_failed",
  "task_retry_clicked",
  "task_retry_succeeded",
  "task_retry_failed",
] as const

export type TaskTelemetryEvent = (typeof TASK_TELEMETRY_EVENTS)[number]

export function trackTaskEvent(
  eventName: TaskTelemetryEvent,
  payload: Record<string, unknown>,
) {
  if (typeof window === "undefined") {
    return
  }

  if (!TASK_TELEMETRY_EVENTS.includes(eventName)) {
    return
  }

  window.dispatchEvent(
    new CustomEvent("harbor:telemetry", {
      detail: {
        eventName,
        payload,
      },
    }),
  )

  if (process.env.NODE_ENV !== "production") {
    console.debug("[task-telemetry]", eventName, payload)
  }
}
