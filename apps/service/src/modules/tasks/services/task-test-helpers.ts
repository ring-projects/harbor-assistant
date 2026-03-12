import { RUNTIME_POLICY_PRESETS } from "../runtime-policy"
import type { CodexTask } from "../types"

export function buildTask(overrides: Partial<CodexTask> = {}): CodexTask {
  return {
    id: "task-1",
    projectId: "project-1",
    projectPath: "/tmp/project-1",
    prompt: "Initial prompt",
    title: "Initial prompt",
    titleSource: "prompt",
    titleUpdatedAt: "2026-03-10T00:00:00.000Z",
    executor: "codex",
    executionMode: "safe",
    runtimePolicy: RUNTIME_POLICY_PRESETS.safe,
    model: "gpt-5",
    status: "completed",
    threadId: "thread-1",
    parentTaskId: null,
    createdAt: "2026-03-10T00:00:00.000Z",
    startedAt: "2026-03-10T00:00:01.000Z",
    finishedAt: "2026-03-10T00:00:02.000Z",
    exitCode: 0,
    command: ["agent", "startSession"],
    stdout: "existing stdout\n",
    stderr: "",
    error: null,
    ...overrides,
  }
}

export function buildProjectSettings(
  overrides: Partial<{
    defaultExecutor: string | null
    defaultModel: string | null
    defaultExecutionMode: string | null
    harborSkillsEnabled: boolean
    harborSkillProfile: string | null
  }> = {},
) {
  return {
    projectId: "project-1",
    defaultExecutor: "codex",
    defaultModel: null,
    defaultExecutionMode: "safe",
    maxConcurrentTasks: 1,
    logRetentionDays: 30,
    eventRetentionDays: 7,
    harborSkillsEnabled: true,
    harborSkillProfile: "default",
    createdAt: new Date("2026-03-10T00:00:00.000Z"),
    updatedAt: new Date("2026-03-10T00:00:00.000Z"),
    ...overrides,
  }
}
