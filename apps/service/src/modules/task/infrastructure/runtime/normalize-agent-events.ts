import type {
  AgentInput,
  AgentType,
  RawAgentEventEnvelope,
} from "../../../../lib/agents"
import {
  extractLocalAttachments,
  normalizeAgentInputItems,
  summarizeAgentInput,
} from "../../domain/task-input"
import { asRecord, toBoolean, toStringOrNull } from "../../../../utils"

type NormalizedTaskEventType =
  | "harbor.cancel_requested"
  | "harbor.cancelled"
  | "session.started"
  | "turn.started"
  | "message"
  | "command.started"
  | "command.output"
  | "command.completed"
  | "web_search.started"
  | "web_search.completed"
  | "file_change"
  | "mcp_tool_call.started"
  | "mcp_tool_call.completed"
  | "reasoning"
  | "todo_list.started"
  | "todo_list.updated"
  | "todo_list.completed"
  | "error"
  | "turn.completed"
  | "turn.failed"
  | "session.completed"

export type NormalizedTaskEvent = {
  eventType: NormalizedTaskEventType
  payload: Record<string, unknown>
  createdAt: Date
}

export type TaskRunEventState = {
  sessionId: string | null
  terminalError: string | null
  hasTerminalErrorEvent: boolean
}

function timestampPayload(createdAt: Date) {
  return {
    timestamp: createdAt.toISOString(),
  }
}

function extractClaudeContentBlocks(value: unknown) {
  if (typeof value === "string") {
    return [value] as unknown[]
  }

  return Array.isArray(value) ? value : []
}

function extractClaudeTextFromBlock(block: unknown): string {
  if (typeof block === "string") {
    return block
  }

  const source = asRecord(block)
  if (!source) {
    return ""
  }

  if (typeof source.text === "string") {
    return source.text
  }
  if (typeof source.thinking === "string") {
    return source.thinking
  }
  if (typeof source.content === "string") {
    return source.content
  }
  if (Array.isArray(source.content)) {
    return source.content.map((item) => extractClaudeTextFromBlock(item)).join("")
  }

  return ""
}

function extractClaudeTextFromContent(content: unknown) {
  return extractClaudeContentBlocks(content)
    .map((block) => extractClaudeTextFromBlock(block))
    .join("")
    .trim()
}

function normalizeSyntheticEvent(
  rawEventType: string,
  payload: Record<string, unknown> | null,
  createdAt: Date,
): NormalizedTaskEvent[] {
  switch (rawEventType) {
    case "harbor.user_prompt": {
      const content = toStringOrNull(payload?.content)?.trim()
      if (!content) {
        return []
      }

      return [
        {
          eventType: "message",
          payload: {
            role: "user",
            content,
            source: toStringOrNull(payload?.source) ?? "user_prompt",
            ...timestampPayload(createdAt),
          },
          createdAt,
        },
      ]
    }
    case "harbor.error": {
      const message = toStringOrNull(payload?.message)
      if (!message) {
        return []
      }

      return [
        {
          eventType: "error",
          payload: {
            message,
            ...timestampPayload(createdAt),
          },
          createdAt,
        },
      ]
    }
    case "harbor.cancel_requested":
    case "harbor.cancelled": {
      const reason = toStringOrNull(payload?.reason)
      if (!reason) {
        return []
      }

      return [
        {
          eventType: rawEventType,
          payload: {
            reason,
            requestedBy: toStringOrNull(payload?.requestedBy) ?? "user",
            ...(payload?.forced === true ? { forced: true } : {}),
            ...timestampPayload(createdAt),
          },
          createdAt,
        },
      ]
    }
    default:
      return []
  }
}

function normalizeCodexEvent(
  envelope: RawAgentEventEnvelope,
): NormalizedTaskEvent[] {
  const payload = asRecord(envelope.event)
  const rawEventType = toStringOrNull(payload?.type) ?? "unknown"
  const createdAt = envelope.createdAt

  if (rawEventType.startsWith("harbor.")) {
    return normalizeSyntheticEvent(rawEventType, payload, createdAt)
  }

  switch (rawEventType) {
    case "thread.started": {
      const sessionId = toStringOrNull(payload?.thread_id)
      return sessionId
        ? [
            {
              eventType: "session.started",
              payload: {
                sessionId,
                ...timestampPayload(createdAt),
              },
              createdAt,
            },
          ]
        : []
    }
    case "turn.started":
      return [
        {
          eventType: "turn.started",
          payload: timestampPayload(createdAt),
          createdAt,
        },
      ]
    case "turn.completed":
      return [
        {
          eventType: "turn.completed",
          payload: timestampPayload(createdAt),
          createdAt,
        },
      ]
    case "turn.failed": {
      const error = asRecord(payload?.error)
      const message = toStringOrNull(error?.message)
      return message
        ? [
            {
              eventType: "turn.failed",
              payload: {
                error: message,
                ...timestampPayload(createdAt),
              },
              createdAt,
            },
          ]
        : []
    }
    case "error": {
      const message = toStringOrNull(payload?.message)
      return message
        ? [
            {
              eventType: "error",
              payload: {
                message,
                ...timestampPayload(createdAt),
              },
              createdAt,
            },
          ]
        : []
    }
    case "item.started":
    case "item.updated":
    case "item.completed": {
      const item = asRecord(payload?.item)
      if (!item) {
        return []
      }

      const itemType = toStringOrNull(item.type)
      if (itemType === "command_execution") {
        const commandId = toStringOrNull(item.id)
        const command = toStringOrNull(item.command)
        if (!commandId || !command) {
          return []
        }

        const nextOutput = toStringOrNull(item.aggregated_output) ?? ""

        const events: NormalizedTaskEvent[] = []
        if (rawEventType === "item.started") {
          events.push({
            eventType: "command.started",
            payload: {
              commandId,
              command,
              ...timestampPayload(createdAt),
            },
            createdAt,
          })
        }
        if (nextOutput) {
          events.push({
            eventType: "command.output",
            payload: {
              commandId,
              output: nextOutput,
              ...timestampPayload(createdAt),
            },
            createdAt,
          })
        }
        if (rawEventType === "item.completed") {
          events.push({
            eventType: "command.completed",
            payload: {
              commandId,
              exitCode:
                typeof item.exit_code === "number" ? item.exit_code : undefined,
              status:
                toStringOrNull(item.status) === "completed" ? "success" : "failed",
              ...timestampPayload(createdAt),
            },
            createdAt,
          })
        }

        return events
      }

      if (itemType === "agent_message" && rawEventType === "item.completed") {
        const text = toStringOrNull(item.text)?.trim()
        return text
          ? [
              {
                eventType: "message",
                payload: {
                  role: "assistant",
                  content: text,
                  source: "agent_message",
                  externalId: toStringOrNull(item.id) ?? undefined,
                  ...timestampPayload(createdAt),
                },
                createdAt,
              },
            ]
          : []
      }

      if (itemType === "reasoning" && rawEventType === "item.completed") {
        const text = toStringOrNull(item.text)?.trim()
        return text
          ? [
              {
                eventType: "reasoning",
                payload: {
                  content: text,
                  ...timestampPayload(createdAt),
                },
                createdAt,
              },
            ]
          : []
      }

      if (itemType === "todo_list") {
        const items = Array.isArray(item.items) ? item.items : []
        const todoListEventType =
          rawEventType === "item.started"
            ? "todo_list.started"
            : rawEventType === "item.updated"
              ? "todo_list.updated"
              : rawEventType === "item.completed"
                ? "todo_list.completed"
                : null
        if (!todoListEventType) {
          return []
        }

        return [
          {
            eventType: todoListEventType,
            payload: {
              todoListId: toStringOrNull(item.id) ?? undefined,
              items: items
                .map((entry) => {
                  const source = asRecord(entry)
                  const text = toStringOrNull(source?.text)
                  if (!text) {
                    return null
                  }

                  return {
                    text,
                    completed: toBoolean(source?.completed),
                  }
                })
                .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
              ...timestampPayload(createdAt),
            },
            createdAt,
          },
        ]
      }

      if (itemType === "error" && rawEventType === "item.completed") {
        const message = toStringOrNull(item.message)
        return message
          ? [
              {
                eventType: "error",
                payload: {
                  message,
                  ...timestampPayload(createdAt),
                },
                createdAt,
              },
            ]
          : []
      }

      if (itemType === "web_search") {
        const searchId = toStringOrNull(item.id)
        const query = toStringOrNull(item.query)
        if (!searchId || !query) {
          return []
        }

        if (rawEventType === "item.started") {
          return [
            {
              eventType: "web_search.started",
              payload: {
                searchId,
                query,
                ...timestampPayload(createdAt),
              },
              createdAt,
            },
          ]
        }
        if (rawEventType === "item.completed") {
          return [
            {
              eventType: "web_search.completed",
              payload: {
                searchId,
                query,
                ...timestampPayload(createdAt),
              },
              createdAt,
            },
          ]
        }
      }

      if (itemType === "file_change" && rawEventType === "item.completed") {
        const changeId = toStringOrNull(item.id)
        if (!changeId) {
          return []
        }

        const changes = Array.isArray(item.changes) ? item.changes : []
        return [
          {
            eventType: "file_change",
            payload: {
              changeId,
              status:
                toStringOrNull(item.status) === "completed" ? "success" : "failed",
              changes: changes
                .map((change) => {
                  const source = asRecord(change)
                  const path = toStringOrNull(source?.path)
                  const kind = source?.kind
                  if (
                    !path ||
                    (kind !== "add" && kind !== "delete" && kind !== "update")
                  ) {
                    return null
                  }

                  return {
                    path,
                    kind,
                  }
                })
                .filter((change): change is NonNullable<typeof change> => Boolean(change)),
              ...timestampPayload(createdAt),
            },
            createdAt,
          },
        ]
      }

      if (itemType === "mcp_tool_call") {
        const callId = toStringOrNull(item.id)
        const server = toStringOrNull(item.server)
        const tool = toStringOrNull(item.tool)
        if (!callId || !server || !tool) {
          return []
        }

        if (rawEventType === "item.started") {
          return [
            {
              eventType: "mcp_tool_call.started",
              payload: {
                callId,
                server,
                tool,
                arguments: item.arguments,
                ...timestampPayload(createdAt),
              },
              createdAt,
            },
          ]
        }

        if (rawEventType === "item.completed") {
          const error = asRecord(item.error)
          return [
            {
              eventType: "mcp_tool_call.completed",
              payload: {
                callId,
                server,
                tool,
                arguments: item.arguments,
                result: item.result,
                error: toStringOrNull(error?.message) ?? undefined,
                status:
                  toStringOrNull(item.status) === "completed"
                    ? "success"
                    : "failed",
                ...timestampPayload(createdAt),
              },
              createdAt,
            },
          ]
        }
      }

      return []
    }
    default:
      return []
  }
}

function normalizeClaudeEvent(
  envelope: RawAgentEventEnvelope,
): NormalizedTaskEvent[] {
  const payload = asRecord(envelope.event)
  const baseType = toStringOrNull(payload?.type) ?? "unknown"
  const rawEventType =
    baseType === "system" && typeof payload?.subtype === "string"
      ? `system.${payload.subtype}`
      : baseType
  const createdAt = envelope.createdAt

  if (rawEventType.startsWith("harbor.")) {
    return normalizeSyntheticEvent(rawEventType, payload, createdAt)
  }

  switch (rawEventType) {
    case "system.init": {
      const sessionId = toStringOrNull(payload?.session_id)
      return sessionId
        ? [
            {
              eventType: "session.started",
              payload: {
                sessionId,
                ...timestampPayload(createdAt),
              },
              createdAt,
            },
          ]
        : []
    }
    case "assistant": {
      const message = asRecord(payload?.message)
      const content = extractClaudeContentBlocks(message?.content)
      const normalizedEvents: NormalizedTaskEvent[] = []

      for (const block of content) {
        const source = asRecord(block)
        if (!source) {
          continue
        }

        if (source.type === "thinking") {
          const thinking = extractClaudeTextFromBlock(source).trim()
          if (thinking) {
            normalizedEvents.push({
              eventType: "reasoning",
              payload: {
                content: thinking,
                ...timestampPayload(createdAt),
              },
              createdAt,
            })
          }
          continue
        }

        if (source.type === "tool_use") {
          const commandId = toStringOrNull(source.id)
          const name = toStringOrNull(source.name)
          if (!commandId || !name) {
            continue
          }

          const serializedInput =
            typeof source.input === "string"
              ? source.input
              : JSON.stringify(source.input ?? {})

          normalizedEvents.push({
            eventType: "command.started",
            payload: {
              commandId,
              command: serializedInput === "{}" ? name : `${name} ${serializedInput}`,
              ...timestampPayload(createdAt),
            },
            createdAt,
          })
          continue
        }

        if (source.type === "tool_result") {
          const commandId = toStringOrNull(source.tool_use_id)
          if (!commandId) {
            continue
          }

          const output = extractClaudeTextFromBlock(source).trim()
          if (output) {
            normalizedEvents.push({
              eventType: "command.output",
              payload: {
                commandId,
                output,
                ...timestampPayload(createdAt),
              },
              createdAt,
            })
          }

          normalizedEvents.push({
            eventType: "command.completed",
            payload: {
              commandId,
              status: source.is_error === true ? "failed" : "success",
              ...timestampPayload(createdAt),
            },
            createdAt,
          })
        }
      }

      const messageContent = extractClaudeTextFromContent(message?.content)
      if (messageContent) {
        normalizedEvents.push({
          eventType: "message",
          payload: {
            role: "assistant",
            content: messageContent,
            source: "assistant_message",
            ...timestampPayload(createdAt),
          },
          createdAt,
        })
      }

      return normalizedEvents
    }
    case "result":
    case "system.result": {
      const resultValue = payload?.result
      const resultText = extractClaudeTextFromContent(resultValue)
      const normalizedEvents: NormalizedTaskEvent[] = []

      if (resultText) {
        normalizedEvents.push({
          eventType: "message",
          payload: {
            role: "assistant",
            content: resultText,
            source: "result",
            ...timestampPayload(createdAt),
          },
          createdAt,
        })
      }

      const result = asRecord(resultValue)
      if (result?.is_error === true) {
        normalizedEvents.push({
          eventType: "turn.failed",
          payload: {
            error:
              typeof result.result === "string"
                ? result.result
                : "Claude Code task failed.",
            ...timestampPayload(createdAt),
          },
          createdAt,
        })
      } else {
        normalizedEvents.push({
          eventType: "turn.completed",
          payload: timestampPayload(createdAt),
          createdAt,
        })
      }

      return normalizedEvents
    }
    case "error":
      return [
        {
          eventType: "error",
          payload: {
            message: toStringOrNull(payload?.error) ?? "Claude Code task failed.",
            ...timestampPayload(createdAt),
          },
          createdAt,
        },
      ]
    default:
      return []
  }
}

export function createTaskRunEventState(): TaskRunEventState {
  return {
    sessionId: null,
    terminalError: null,
    hasTerminalErrorEvent: false,
  }
}

export function createSyntheticErrorEvent(args: {
  message: string
  createdAt?: Date
}): NormalizedTaskEvent {
  const createdAt = args.createdAt ?? new Date()
  return {
    eventType: "error",
    payload: {
      message: args.message,
      ...timestampPayload(createdAt),
    },
    createdAt,
  }
}

export function createSyntheticCancelRequestedEvent(args: {
  reason: string
  requestedBy?: string
  createdAt?: Date
}): NormalizedTaskEvent {
  const createdAt = args.createdAt ?? new Date()
  return {
    eventType: "harbor.cancel_requested",
    payload: {
      reason: args.reason,
      requestedBy: args.requestedBy ?? "user",
      ...timestampPayload(createdAt),
    },
    createdAt,
  }
}

export function createSyntheticCancelledEvent(args: {
  reason: string
  requestedBy?: string
  forced?: boolean
  createdAt?: Date
}): NormalizedTaskEvent {
  const createdAt = args.createdAt ?? new Date()
  return {
    eventType: "harbor.cancelled",
    payload: {
      reason: args.reason,
      requestedBy: args.requestedBy ?? "user",
      ...(args.forced ? { forced: true } : {}),
      ...timestampPayload(createdAt),
    },
    createdAt,
  }
}

export function createSyntheticUserInputEvent(args: {
  input: AgentInput
  createdAt?: Date
}): NormalizedTaskEvent | null {
  const input =
    typeof args.input === "string"
      ? args.input.trim()
      : normalizeAgentInputItems(args.input)
  const summary = summarizeAgentInput(input)

  if (!summary) {
    return null
  }

  const createdAt = args.createdAt ?? new Date()
  const attachments = extractLocalAttachments(input)
  return {
    eventType: "message",
    payload: {
      role: "user",
      content: summary,
      summary,
      input,
      ...(attachments.length > 0 ? { attachments } : {}),
      source: "user_input",
      ...timestampPayload(createdAt),
    },
    createdAt,
  }
}

export function applyNormalizedTaskEvents(
  state: TaskRunEventState,
  events: NormalizedTaskEvent[],
): TaskRunEventState {
  let nextState = state

  for (const event of events) {
    if (event.eventType === "session.started") {
      const sessionId = toStringOrNull(event.payload.sessionId)
      if (sessionId) {
        nextState = {
          ...nextState,
          sessionId,
        }
      }
    }

    if (event.eventType === "error") {
      nextState = {
        ...nextState,
        terminalError:
          toStringOrNull(event.payload.message) ?? "Agent run failed.",
        hasTerminalErrorEvent: true,
      }
    }

    if (event.eventType === "turn.failed") {
      nextState = {
        ...nextState,
        terminalError:
          toStringOrNull(event.payload.error) ?? "Agent run failed.",
        hasTerminalErrorEvent: true,
      }
    }
  }

  return nextState
}

export function normalizeRawAgentEvent(args: {
  envelope: RawAgentEventEnvelope
  state: TaskRunEventState
}): NormalizedTaskEvent[] {
  switch (args.envelope.agentType) {
    case "codex":
      return normalizeCodexEvent(args.envelope)
    case "claude-code":
      return normalizeClaudeEvent(args.envelope)
    default:
      return []
  }
}

export function normalizeAgentType(value: string): AgentType {
  return value === "claude-code" ? "claude-code" : "codex"
}
