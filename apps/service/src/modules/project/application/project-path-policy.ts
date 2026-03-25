export interface ProjectPathPolicy {
  canonicalizeProjectRoot(rawPath: string): Promise<string>
}
