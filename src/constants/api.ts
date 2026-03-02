export const API_ROUTES = {
  projects: "/api/projects",
  capabilities: "/api/capabilities",
  fsList: "/api/fs/list",
} as const

export function getProjectByIdApiRoute(projectId: string) {
  return `${API_ROUTES.projects}/${encodeURIComponent(projectId)}`
}
