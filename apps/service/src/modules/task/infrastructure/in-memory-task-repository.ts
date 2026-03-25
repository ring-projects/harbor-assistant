import type {
  TaskRepository,
  ListProjectTasksInput,
} from "../application/task-repository"
import type {
  CreateTaskRecordInput,
  TaskRecordStore,
} from "../application/task-record-store"
import type { Task } from "../domain/task"

export class InMemoryTaskRepository implements TaskRepository, TaskRecordStore {
  private readonly tasks = new Map<string, Task>()

  constructor(seed: Task[] = []) {
    for (const task of seed) {
      this.tasks.set(task.id, task)
    }
  }

  async create(input: CreateTaskRecordInput): Promise<void> {
    this.tasks.set(input.task.id, input.task)
  }

  async findById(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null
  }

  async listByProject(input: ListProjectTasksInput): Promise<Task[]> {
    const includeArchived = input.includeArchived ?? false
    const limit = input.limit

    const tasks = [...this.tasks.values()]
      .filter((task) => task.projectId === input.projectId)
      .filter((task) => includeArchived || task.archivedAt === null)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())

    if (limit === undefined) {
      return tasks
    }

    return tasks.slice(0, limit)
  }

  async save(task: Task): Promise<void> {
    this.tasks.set(task.id, task)
  }

  async delete(taskId: string): Promise<void> {
    this.tasks.delete(taskId)
  }
}
