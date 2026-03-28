import type {
  TaskRepository,
  ListProjectTasksInput,
} from "../application/task-repository"
import type {
  CreateTaskRecordInput,
  TaskRecordStore,
} from "../application/task-record-store"
import type { Task } from "../domain/task"
import { attachTaskRuntime, type TaskRecord } from "../application/task-read-models"

export class InMemoryTaskRepository implements TaskRepository, TaskRecordStore {
  private readonly tasks = new Map<string, TaskRecord>()

  constructor(seed: TaskRecord[] = []) {
    for (const task of seed) {
      this.tasks.set(task.id, task)
    }
  }

  async create(input: CreateTaskRecordInput): Promise<void> {
    this.tasks.set(
      input.task.id,
      attachTaskRuntime(input.task, {
        executor: input.runtimeConfig.executor,
        model: input.runtimeConfig.model,
        executionMode: input.runtimeConfig.executionMode,
      }),
    )
  }

  async findById(id: string): Promise<TaskRecord | null> {
    return this.tasks.get(id) ?? null
  }

  async listByProject(input: ListProjectTasksInput): Promise<TaskRecord[]> {
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
    const current = this.tasks.get(task.id)
    this.tasks.set(
      task.id,
      attachTaskRuntime(task, {
        executor: current?.executor ?? null,
        model: current?.model ?? null,
        executionMode: current?.executionMode ?? null,
      }),
    )
  }

  async delete(taskId: string): Promise<void> {
    this.tasks.delete(taskId)
  }
}
