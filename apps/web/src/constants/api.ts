export const API_ROUTES = {
  projects: "/api/projects",
  capabilities: "/api/capabilities",
  fsList: "/api/fs/list",
  v1Tasks: "/api/v1/tasks",
  v1ProjectTasks: "/api/v1/projects",
  v1Capabilities: "/api/v1/executors/capabilities",
} as const

export function getProjectByIdApiRoute(projectId: string) {
  return `${API_ROUTES.projects}/${encodeURIComponent(projectId)}`
}

export function getV1ProjectTasksApiRoute(projectId: string) {
  return `${API_ROUTES.v1ProjectTasks}/${encodeURIComponent(projectId)}/tasks`
}

export function getV1TaskByIdApiRoute(taskId: string) {
  return `${API_ROUTES.v1Tasks}/${encodeURIComponent(taskId)}`
}

export function getV1TaskCancelApiRoute(taskId: string) {
  return `${getV1TaskByIdApiRoute(taskId)}/cancel`
}

export function getV1TaskRetryApiRoute(taskId: string) {
  return `${getV1TaskByIdApiRoute(taskId)}/retry`
}

export function getV1TaskEventsApiRoute(taskId: string) {
  return `${getV1TaskByIdApiRoute(taskId)}/events`
}
