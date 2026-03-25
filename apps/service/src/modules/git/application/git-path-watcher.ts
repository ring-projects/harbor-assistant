export type GitPathChangeEvent = {
  path: string
  changedAt: string
}

export interface GitPathWatcher {
  subscribe(
    path: string,
    listener: (event: GitPathChangeEvent) => void,
  ): Promise<(() => Promise<void>) | (() => void)>
  close?(): Promise<void>
}
