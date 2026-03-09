import { createTaskError, TaskError } from "../errors"
import type { TaskRepository } from "../repositories"

export function createTaskConversationService(args: {
  taskRepository: Pick<TaskRepository, "readTaskConversation">
}) {
  const { taskRepository } = args

  async function readConversation(args: { taskId: string; limit?: number }) {
    try {
      return await taskRepository.readTaskConversation(args)
    } catch (error) {
      if (error instanceof TaskError) {
        throw error
      }

      throw createTaskError.readError(
        "Failed to read Codex task conversation.",
        error,
      )
    }
  }

  return {
    readConversation,
  }
}

export type TaskConversationService = ReturnType<
  typeof createTaskConversationService
>
