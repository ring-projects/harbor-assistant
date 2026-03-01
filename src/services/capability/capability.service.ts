import {
  EXECUTOR_COMMAND_CANDIDATES,
  EXECUTOR_IDS,
} from "@/constants/executors"
import { inspectCodexExecutor } from "@/services/executors/adapters/codex.adapter"
import {
  findInstalledCommand,
  resolveCommandVersion,
} from "@/services/executors/shared/command"
import type {
  ExecutorCapability,
  ExecutorCapabilityMap,
  ExecutorCapabilityResult,
  ExecutorId,
} from "@/services/executors/types"

async function inspectBasicExecutor(executor: ExecutorId) {
  const command = await findInstalledCommand(EXECUTOR_COMMAND_CANDIDATES[executor])
  if (!command) {
    return {
      installed: false,
      version: null,
    } satisfies ExecutorCapability
  }

  return {
    installed: true,
    version: await resolveCommandVersion(command),
  } satisfies ExecutorCapability
}

export async function getExecutorCapabilities(): Promise<ExecutorCapabilityResult> {
  const [codex, opencode, claudcode] = await Promise.all([
    inspectCodexExecutor(),
    inspectBasicExecutor("opencode"),
    inspectBasicExecutor("claudcode"),
  ])

  const executors: ExecutorCapabilityMap = {
    codex,
    opencode,
    claudcode,
  }

  const availableExecutors = EXECUTOR_IDS.filter(
    (executor) => executors[executor].installed,
  )

  return {
    checkedAt: new Date().toISOString(),
    executors,
    availableExecutors,
  }
}
