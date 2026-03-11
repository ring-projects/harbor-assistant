export function projectRoom(projectId: string) {
  return `project:${projectId}`
}

export function taskRoom(taskId: string) {
  return `task:${taskId}`
}

export function taskEventsRoom(taskId: string) {
  return `task-events:${taskId}`
}
