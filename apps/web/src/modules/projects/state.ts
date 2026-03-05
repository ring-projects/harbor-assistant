export type CreateProjectDraft = {
  path: string
  name: string
}

export const DEFAULT_CREATE_PROJECT_DRAFT: CreateProjectDraft = {
  path: "",
  name: "",
}

export function createProjectDraft(
  overrides?: Partial<CreateProjectDraft>,
): CreateProjectDraft {
  return {
    ...DEFAULT_CREATE_PROJECT_DRAFT,
    ...overrides,
  }
}
