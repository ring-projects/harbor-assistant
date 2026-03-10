import type { AgentEvent, AgentType } from "../../../lib/agents"
import { AgentFactory } from "../../../lib/agents"
import type { TaskRepository } from "../repositories"

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

export type AgentGatewayRunResult = {
  sessionId: string
  stdout: string
  stderr: string
}

export function createTaskAgentGateway(args: {
  taskRepository: Pick<
    TaskRepository,
    "appendTimelineItem" | "setTaskThreadId"
  >
}) {
  const { taskRepository } = args

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
        await taskRepository.setTaskThreadId({
          taskId,
          threadId: event.sessionId,
        })
        await taskRepository.appendTimelineItem({
          taskId,
          kind: "system",
          source: "session.started",
          content: `Session started: ${event.sessionId}`,
          payload: JSON.stringify({
            sessionId: event.sessionId,
          }),
        })
        break
      }

      case "message": {
        if (threadId && event.content.trim()) {
          await taskRepository.appendTimelineItem({
            taskId,
            kind: "message",
            role: event.role,
            content: event.content,
            source: event.source,
            createdAt: event.timestamp.toISOString(),
          })
        }
        break
      }

      case "command.output": {
        stdout = appendWithLimit(stdout, event.output)
        await taskRepository.appendTimelineItem({
          taskId,
          kind: "stdout",
          source: event.commandId,
          content: event.output,
          createdAt: event.timestamp.toISOString(),
        })
        break
      }

      case "command.completed": {
        await taskRepository.appendTimelineItem({
          taskId,
          kind: "system",
          source: "command.completed",
          content: `Command completed (${event.status}${event.exitCode === undefined ? "" : `, exit=${String(event.exitCode)}`}).`,
          payload: JSON.stringify({
            commandId: event.commandId,
            exitCode: event.exitCode ?? null,
            status: event.status,
          }),
          createdAt: event.timestamp.toISOString(),
        })
        break
      }

      case "reasoning": {
        if (threadId && event.content.trim()) {
          await taskRepository.appendTimelineItem({
            taskId,
            kind: "message",
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
            await taskRepository.appendTimelineItem({
              taskId,
              kind: "message",
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
          await taskRepository.appendTimelineItem({
            taskId,
            kind: "error",
            content: event.message,
            source: "error",
            createdAt: event.timestamp.toISOString(),
          })
        }
        break
      }

      case "turn.failed": {
        await taskRepository.appendTimelineItem({
          taskId,
          kind: "error",
          source: "turn.failed",
          content: event.error,
          payload: JSON.stringify({
            error: event.error,
          }),
          createdAt: event.timestamp.toISOString(),
        })
        break
      }
    }

    return { threadId, stdout }
  }

  async function startSessionAndRun(
    args: RunTaskArgs,
  ): Promise<AgentGatewayRunResult> {
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
        if (event.type === "session.started" && !sessionId) {
          sessionId = event.sessionId
          await taskRepository.setTaskThreadId({
            taskId: args.taskId,
            threadId: sessionId,
          })
        }

        if (sessionId && !userMessagePersisted) {
          userMessagePersisted = true
          await taskRepository.appendTimelineItem({
            taskId: args.taskId,
            kind: "message",
            role: "user",
            content: args.prompt,
            source: "user_prompt",
          })
        }

        const result = await handleAgentEvent({
          event,
          taskId: args.taskId,
          threadId: sessionId,
          stdout,
        })

        sessionId = result.threadId
        stdout = result.stdout

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

  async function resumeSessionAndRun(
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
        if (!userMessagePersisted) {
          userMessagePersisted = true
          await taskRepository.appendTimelineItem({
            taskId: args.taskId,
            kind: "message",
            role: "user",
            content: args.prompt,
            source: "user_prompt",
          })
        }

        const result = await handleAgentEvent({
          event,
          taskId: args.taskId,
          threadId: args.sessionId,
          stdout,
        })

        stdout = result.stdout

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

  return {
    startSessionAndRun,
    resumeSessionAndRun,
  }
}

export type TaskAgentGateway = ReturnType<typeof createTaskAgentGateway>
