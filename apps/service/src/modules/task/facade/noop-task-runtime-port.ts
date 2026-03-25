import type { TaskRuntimePort } from "../application/task-runtime-port"

export function createNoopTaskRuntimePort(): TaskRuntimePort {
  return {
    async startTaskExecution() {},
  }
}
