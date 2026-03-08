import { readTaskConversationFromDb } from "./task.repository"

export async function readTaskConversation(args: {
  taskId: string
  limit?: number
}) {
  return readTaskConversationFromDb({
    taskId: args.taskId,
    limit: args.limit,
  })
}
