import type { AgentInputItem } from "../../../lib/agents"
import type { TaskEffort } from "../../task"
import type { TaskDetail, TaskListItem } from "../../task"

export interface OrchestrationTaskPort {
  createTaskForOrchestration(input: {
    projectId: string
    orchestrationId: string
    title?: string
    prompt?: string | null
    items?: AgentInputItem[] | null
    executor: string
    model: string
    executionMode: string
    effort: TaskEffort
  }): Promise<TaskDetail>
  listTasksForOrchestration(input: {
    orchestrationId: string
    includeArchived?: boolean
    limit?: number
  }): Promise<TaskListItem[]>
}
