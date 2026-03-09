import type { AgentEvent, AgentType } from "../../lib/agents"
import { AgentFactory } from "../../lib/agents"
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
  agentType?: AgentType
  signal?: AbortSignal
}

function appendWithLimit(base: string, nextChunk: string) {
  const combined = `${base}${nextChunk}`
  if (combined.length <= MAX_CAPTURED_OUTPUT_LENGTH) {
    return combined
  }

  return combined.slice(combined.length - MAX_CAPTURED_OUTPUT_LENGTH)
}

/**
 * Handle agent event and persist to database
 */
async function handleAgentEvent(args: {
  event: AgentEvent
  taskId: string
  threadId: string | null
  stdout: string
}): Promise<{ threadId: string | null; stdout: string }> {
  let { threadId, stdout } = args
  const { event, taskId } = args

  switch (event.type) {
    case "session.started": {
      threadId = event.sessionId
      await appendTaskEvent({
        taskId,
        type: "system",
        payload: JSON.stringify({
          kind: "session-started",
          sessionId: event.sessionId,
        }),
      })
      break
    }

    case "message": {
      if (threadId && event.content.trim()) {
        await appendTaskMessage({
          threadId,
          taskId,
          role: event.role,
          content: event.content,
          source: event.source,
          externalId: event.externalId ?? null,
          createdAt: event.timestamp.toISOString(),
        })
      }
      break
    }

    case "command.output": {
      stdout = appendWithLimit(stdout, event.output)
      await appendTaskEvent({
        taskId,
        type: "stdout",
        payload: event.output,
      })
      break
    }

    case "command.completed": {
      await appendTaskEvent({
        taskId,
        type: "system",
        payload: JSON.stringify({
          kind: "command-completed",
          commandId: event.commandId,
          exitCode: event.exitCode ?? null,
          status: event.status,
        }),
      })
      break
    }

    case "reasoning": {
      if (threadId && event.content.trim()) {
        await appendTaskMessage({
          threadId,
          taskId,
          role: "system",
          content: event.content,
          source: "reasoning",
          createdAt: event.timestamp.toISOString(),
        })
      }
      break
    }

    case "todo_list": {
      if (threadId) {
        const content = event.items
          .map((item) => `${item.completed ? "[x]" : "[ ]"} ${item.text}`)
          .join("\n")

        if (content.trim()) {
          await appendTaskMessage({
            threadId,
            taskId,
            role: "system",
            content,
            source: "todo_list",
            createdAt: event.timestamp.toISOString(),
          })
        }
      }
      break
    }

    case "error": {
      if (threadId && event.message.trim()) {
        await appendTaskMessage({
          threadId,
          taskId,
          role: "system",
          content: event.message,
          source: "error",
          createdAt: event.timestamp.toISOString(),
        })
      }
      break
    }

    case "turn.failed": {
      await appendTaskEvent({
        taskId,
        type: "system",
        payload: JSON.stringify({
          kind: "turn-failed",
          error: event.error,
        }),
      })
      break
    }
  }

  return { threadId, stdout }
}

export type AgentGatewayRunResult = {
  sessionId: string
  stdout: string
  stderr: string
}

/**
 * Agent Gateway
 * Unified agent execution gateway, replaces the old codex-sdk.gateway
 */
export class AgentGateway {
  async startSessionAndRun(args: RunTaskArgs): Promise<AgentGatewayRunResult> {
    const agentType = args.agentType ?? "codex"
    const agent = AgentFactory.getAgent(agentType)

    let sessionId: string | null = null
    let stdout = ""
    let userMessagePersisted = false
    let terminalError: string | null = null

    const events = agent.startSessionAndRun(
      {
        workingDirectory: args.projectPath,
        model: args.model ?? undefined,
        sandboxMode: "workspace-write",
        approvalPolicy: "never",
        networkAccessEnabled: false,
      },
      args.prompt,
      args.signal,
    )

    try {
      for await (const event of events) {
        // Ensure session is attached to task
        if (event.type === "session.started" && !sessionId) {
          sessionId = event.sessionId
          await attachThreadToTask({
            taskId: args.taskId,
            threadId: sessionId,
            projectId: args.projectId,
            projectPath: args.projectPath,
            model: args.model,
          })
        }

        // Ensure user message is persisted
        if (sessionId && !userMessagePersisted) {
          userMessagePersisted = true
          await appendTaskMessage({
            threadId: sessionId,
            taskId: args.taskId,
            role: "user",
            content: args.prompt,
            source: "user_prompt",
            externalId: `${args.taskId}:user`,
          })
        }

        // Handle event
        const result = await handleAgentEvent({
          event,
          taskId: args.taskId,
          threadId: sessionId,
          stdout,
        })

        sessionId = result.threadId
        stdout = result.stdout

        // Capture terminal errors
        if (event.type === "turn.failed" || event.type === "error") {
          terminalError =
            event.type === "turn.failed" ? event.error : event.message
        }
      }
    } catch (error) {
      terminalError = String(error)
    }

    if (!sessionId) {
      throw new Error("Agent did not provide a session id.")
    }

    if (terminalError) {
      throw new Error(terminalError)
    }

    return {
      sessionId,
      stdout,
      stderr: "",
    }
  }

  async resumeSessionAndRun(
    args: RunTaskArgs & {
      sessionId: string
    },
  ): Promise<AgentGatewayRunResult> {
    const agentType = args.agentType ?? "codex"
    const agent = AgentFactory.getAgent(agentType)

    let stdout = ""
    let userMessagePersisted = false
    let terminalError: string | null = null

    const events = agent.resumeSessionAndRun(
      args.sessionId,
      {
        workingDirectory: args.projectPath,
        model: args.model ?? undefined,
        sandboxMode: "workspace-write",
        approvalPolicy: "never",
        networkAccessEnabled: false,
      },
      args.prompt,
      args.signal,
    )

    try {
      for await (const event of events) {
        // Ensure user message is persisted
        if (!userMessagePersisted) {
          userMessagePersisted = true
          await appendTaskMessage({
            threadId: args.sessionId,
            taskId: args.taskId,
            role: "user",
            content: args.prompt,
            source: "user_prompt",
            externalId: `${args.taskId}:user`,
          })
        }

        // Handle event
        const result = await handleAgentEvent({
          event,
          taskId: args.taskId,
          threadId: args.sessionId,
          stdout,
        })

        stdout = result.stdout

        // Capture terminal errors
        if (event.type === "turn.failed" || event.type === "error") {
          terminalError =
            event.type === "turn.failed" ? event.error : event.message
        }
      }
    } catch (error) {
      terminalError = String(error)
    }

    if (terminalError) {
      throw new Error(terminalError)
    }

    return {
      sessionId: args.sessionId,
      stdout,
      stderr: "",
    }
  }
}

export const agentGateway = new AgentGateway()
