import type { Task } from "../domain/task"

export type ListProjectTasksInput = {
  projectId: string
  includeArchived?: boolean
  limit?: number
}

export interface TaskRepository {
  findById(id: string): Promise<Task | null>
  listByProject(input: ListProjectTasksInput): Promise<Task[]>
  save(task: Task): Promise<void>
  delete(taskId: string): Promise<void>
}
