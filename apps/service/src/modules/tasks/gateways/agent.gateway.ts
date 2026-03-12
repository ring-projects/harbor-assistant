import type { AgentEvent, AgentType } from "../../../lib/agents"
import { AgentFactory } from "../../../lib/agents"
import type { TaskRepository } from "../repositories"
import type { RuntimePolicy } from "../runtime-policy"
import { runtimePolicyToSessionOptions } from "../runtime-policy"
import type { TaskEventBus } from "../services/task-event-bus"

const MAX_CAPTURED_OUTPUT_LENGTH = 200_000

type RunTaskArgs = {
  taskId: string
  projectId: string
  projectPath: string
  prompt: string
  model: string | null
  agentType?: AgentType
  runtimePolicy: RuntimePolicy
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
    "appendTaskAgentEvent" | "setTaskThreadId"
  >
  taskEventBus: Pick<TaskEventBus, "publish">
  harborApiBaseUrl?: string
}) {
  const { taskRepository, taskEventBus } = args

  function buildHarborSessionEnv(input: RunTaskArgs) {
    if (!args.harborApiBaseUrl) {
      return undefined
    }

    return {
      HARBOR_SERVICE_BASE_URL: args.harborApiBaseUrl,
      HARBOR_PROJECT_ID: input.projectId,
      HARBOR_TASK_ID: input.taskId,
    }
  }

  function serializeAgentEvent(event: AgentEvent): Record<string, unknown> {
    return JSON.parse(JSON.stringify(event)) as Record<string, unknown>
  }

  async function handleAgentEvent(args: {
    event: AgentEvent
    taskId: string
    threadId: string | null
    stdout: string
  }): Promise<{ threadId: string | null; stdout: string }> {
    let { threadId, stdout } = args
    const { event, taskId } = args

    const rawEvent = await taskRepository.appendTaskAgentEvent({
      taskId,
      eventType: event.type,
      payload: serializeAgentEvent(event),
      createdAt: event.timestamp.toISOString(),
    })

    taskEventBus.publish({
      type: "agent_event",
      taskId,
      event: rawEvent,
    })

    if (event.type === "session.started") {
      threadId = event.sessionId
      await taskRepository.setTaskThreadId({
        taskId,
        threadId: event.sessionId,
      })
    }

    if (event.type === "command.output") {
      stdout = appendWithLimit(stdout, event.output)
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
    let terminalError: string | null = null

    const events = agent.startSessionAndRun(
      {
        workingDirectory: args.projectPath,
        model: args.model ?? undefined,
        env: buildHarborSessionEnv(args),
        ...runtimePolicyToSessionOptions(args.runtimePolicy),
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
    let terminalError: string | null = null

    const events = agent.resumeSessionAndRun(
      args.sessionId,
      {
        workingDirectory: args.projectPath,
        model: args.model ?? undefined,
        env: buildHarborSessionEnv(args),
        ...runtimePolicyToSessionOptions(args.runtimePolicy),
      },
      args.prompt,
      args.signal,
    )

    try {
      for await (const event of events) {
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
