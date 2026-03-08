import {
  Codex,
  type CommandExecutionItem,
  type Thread,
  type ThreadEvent,
  type ThreadItem,
} from "@openai/codex-sdk"

import { DEFAULT_CODEX_COMMAND } from "../../constants/executors"
import {
  appendTaskEvent,
  appendTaskMessage,
  attachThreadToTask,
} from "./task.repository"

const MAX_CAPTURED_OUTPUT_LENGTH = 200_000

type RunTaskArgs = {
  taskId: string
  projectId: string
  projectPath: string
  prompt: string
  model: string | null
  signal?: AbortSignal
}

function appendWithLimit(base: string, nextChunk: string) {
  const combined = `${base}${nextChunk}`
  if (combined.length <= MAX_CAPTURED_OUTPUT_LENGTH) {
    return combined
  }

  return combined.slice(combined.length - MAX_CAPTURED_OUTPUT_LENGTH)
}

function buildThreadOptions(args: {
  projectPath: string
  model: string | null
}) {
  return {
    workingDirectory: args.projectPath,
    model: args.model ?? undefined,
    sandboxMode: "workspace-write" as const,
    approvalPolicy: "never" as const,
    networkAccessEnabled: false,
    skipGitRepoCheck: true,
  }
}

function formatTodoList(item: Extract<ThreadItem, { type: "todo_list" }>) {
  return item.items
    .map((entry) => `${entry.completed ? "[x]" : "[ ]"} ${entry.text}`)
    .join("\n")
}

function isReadableSystemItem(item: ThreadItem) {
  return (
    item.type === "reasoning" || item.type === "todo_list" || item.type === "error"
  )
}

async function persistReadableSystemItem(args: {
  item: ThreadItem
  threadId: string
  taskId: string
}) {
  const { item, threadId, taskId } = args

  if (!isReadableSystemItem(item)) {
    return
  }

  const content =
    item.type === "reasoning"
      ? item.text
      : item.type === "todo_list"
        ? formatTodoList(item)
        : item.message

  if (!content.trim()) {
    return
  }

  await appendTaskMessage({
    threadId,
    taskId,
    role: "system",
    content,
    source: item.type,
    externalId: item.id,
  })
}

export type CodexSdkRunResult = {
  threadId: string
  stdout: string
  stderr: string
}

export class CodexSdkGateway {
  private readonly codex: Codex

  constructor() {
    this.codex = new Codex({
      codexPathOverride: DEFAULT_CODEX_COMMAND,
    })
  }

  startThreadAndRun(args: RunTaskArgs) {
    const thread = this.codex.startThread(
      buildThreadOptions({
        projectPath: args.projectPath,
        model: args.model,
      }),
    )

    return this.runStreamed({
      ...args,
      thread,
    })
  }

  resumeThreadAndRun(
    args: RunTaskArgs & {
      threadId: string
    },
  ) {
    const thread = this.codex.resumeThread(
      args.threadId,
      buildThreadOptions({
        projectPath: args.projectPath,
        model: args.model,
      }),
    )

    return this.runStreamed({
      ...args,
      thread,
    })
  }

  async runStreamed(
    args: RunTaskArgs & {
      thread: Thread
      threadId?: string
    },
  ): Promise<CodexSdkRunResult> {
    let resolvedThreadId = args.threadId ?? args.thread.id
    let stdout = ""
    const commandOutputs = new Map<string, string>()
    let userMessagePersisted = false
    let terminalFailureMessage: string | null = null

    const ensureThreadAttached = async () => {
      if (!resolvedThreadId) {
        return null
      }

      await attachThreadToTask({
        taskId: args.taskId,
        threadId: resolvedThreadId,
        projectId: args.projectId,
        projectPath: args.projectPath,
        model: args.model,
      })

      return resolvedThreadId
    }

    const ensureUserMessage = async () => {
      const threadId = await ensureThreadAttached()
      if (!threadId || userMessagePersisted) {
        return threadId
      }

      userMessagePersisted = true
      await appendTaskMessage({
        threadId,
        taskId: args.taskId,
        role: "user",
        content: args.prompt,
        source: "user_prompt",
        externalId: `${args.taskId}:user`,
      })

      return threadId
    }

    const syncCommandOutput = async (item: CommandExecutionItem) => {
      const previous = commandOutputs.get(item.id) ?? ""
      const next = item.aggregated_output ?? ""
      const delta = next.startsWith(previous) ? next.slice(previous.length) : next
      commandOutputs.set(item.id, next)

      if (!delta) {
        return
      }

      stdout = appendWithLimit(stdout, delta)
      await appendTaskEvent({
        taskId: args.taskId,
        type: "stdout",
        payload: delta,
      })
    }

    const handleItem = async (eventType: ThreadEvent["type"], item: ThreadItem) => {
      const threadId = await ensureUserMessage()
      if (!threadId) {
        return
      }

      if (item.type === "command_execution") {
        await syncCommandOutput(item)

        if (eventType === "item.completed") {
          await appendTaskEvent({
            taskId: args.taskId,
            type: "system",
            payload: JSON.stringify({
              kind: item.type,
              id: item.id,
              status: item.status,
              command: item.command,
              exitCode: item.exit_code ?? null,
            }),
          })
        }

        return
      }

      if (item.type === "agent_message" && eventType === "item.completed") {
        if (!item.text.trim()) {
          return
        }

        await appendTaskMessage({
          threadId,
          taskId: args.taskId,
          role: "assistant",
          content: item.text,
          source: "agent_message",
          externalId: item.id,
        })
        return
      }

      if (isReadableSystemItem(item) && eventType === "item.completed") {
        await persistReadableSystemItem({
          item,
          threadId,
          taskId: args.taskId,
        })
        return
      }

      if (eventType === "item.completed") {
        await appendTaskEvent({
          taskId: args.taskId,
          type: "system",
          payload: JSON.stringify({
            kind: item.type,
            item,
          }),
        })
      }
    }

    const { events } = await args.thread.runStreamed(args.prompt, {
      signal: args.signal,
    })

    for await (const event of events) {
      switch (event.type) {
        case "thread.started": {
          resolvedThreadId = event.thread_id
          await ensureThreadAttached()
          await appendTaskEvent({
            taskId: args.taskId,
            type: "system",
            payload: JSON.stringify({
              kind: "codex-thread",
              threadId: event.thread_id,
            }),
          })
          await ensureUserMessage()
          break
        }

        case "turn.started": {
          await ensureUserMessage()
          break
        }

        case "item.started":
        case "item.updated":
        case "item.completed": {
          await handleItem(event.type, event.item)
          break
        }

        case "turn.failed": {
          terminalFailureMessage = event.error.message
          break
        }

        case "error": {
          terminalFailureMessage = event.message
          break
        }

        case "turn.completed": {
          break
        }
      }
    }

    const threadId = await ensureUserMessage()
    if (!threadId) {
      throw new Error("Codex SDK did not provide a thread id.")
    }

    if (terminalFailureMessage) {
      throw new Error(terminalFailureMessage)
    }

    return {
      threadId,
      stdout,
      stderr: "",
    }
  }
}

export const codexSdkGateway = new CodexSdkGateway()
