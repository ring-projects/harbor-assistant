export type CodexConfigSource = "global" | "project"

export type CodexConfigFileInfo = {
  path: string
  exists: boolean
}

export type CodexMcpServer = {
  name: string
  source: CodexConfigSource
  command?: string
  url?: string
  args: string[]
  env: Record<string, string>
  headers: Record<string, string>
  enabled?: boolean
  globalEnabled?: boolean
  projectEnabled?: boolean
}

export type CodexMcpConfigResult = {
  globalConfig: CodexConfigFileInfo
  projectConfig: CodexConfigFileInfo
  servers: CodexMcpServer[]
}

export type CodexSkill = {
  name: string
  path: string
  source: CodexConfigSource
  hasSkillFile: boolean
  skillFilePath: string
}

export type CodexSkillsResult = {
  globalSkillsRoot: CodexConfigFileInfo
  projectSkillsRoot: CodexConfigFileInfo
  skills: CodexSkill[]
}

export type CodexSkillSupportFiles = {
  references: string[]
  scripts: string[]
  assets: string[]
}

export type CodexSkillFile = {
  relativePath: string
  absolutePath: string
  isMarkdown: boolean
}

export type CodexSkillPreview = {
  skill: CodexSkill
  files: CodexSkillFile[]
  selectedFile: {
    relativePath: string
    absolutePath: string
    content: string
    isMarkdown: boolean
  } | null
  supportFiles: CodexSkillSupportFiles
}
