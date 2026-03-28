import type { Task } from "../domain/task"
import type { TaskRecord } from "./task-read-models"

export type ListProjectTasksInput = {
  projectId: string
  includeArchived?: boolean
  limit?: number
}

export interface TaskRepository {
  findById(id: string): Promise<TaskRecord | null>
  listByProject(input: ListProjectTasksInput): Promise<TaskRecord[]>
  save(task: Task): Promise<void>
  delete(taskId: string): Promise<void>
}
