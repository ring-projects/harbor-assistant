export const API_ROUTES = {
  projects: "/api/projects",
  fsList: "/api/fs/list",
  v1Tasks: "/api/v1/tasks",
  v1ProjectTasks: "/api/v1/projects",
} as const

export function getProjectByIdApiRoute(projectId: string) {
  return `${API_ROUTES.projects}/${encodeURIComponent(projectId)}`
}

export function getProjectSettingsApiRoute(projectId: string) {
  return `${getProjectByIdApiRoute(projectId)}/settings`
}

export function getV1ProjectTasksApiRoute(projectId: string) {
  return `${API_ROUTES.v1ProjectTasks}/${encodeURIComponent(projectId)}/tasks`
}

export function getV1ProjectGitDiffApiRoute(projectId: string) {
  return `${API_ROUTES.v1ProjectTasks}/${encodeURIComponent(projectId)}/git/diff`
}

export function getV1TaskByIdApiRoute(taskId: string) {
  return `${API_ROUTES.v1Tasks}/${encodeURIComponent(taskId)}`
}

export function getV1TaskBreakApiRoute(taskId: string) {
  return `${getV1TaskByIdApiRoute(taskId)}/break`
}

export function getV1TaskArchiveApiRoute(taskId: string) {
  return `${getV1TaskByIdApiRoute(taskId)}/archive`
}

export function getV1TaskRetryApiRoute(taskId: string) {
  return `${getV1TaskByIdApiRoute(taskId)}/retry`
}

export function getV1TaskEventsApiRoute(taskId: string) {
  return `${getV1TaskByIdApiRoute(taskId)}/events`
}
