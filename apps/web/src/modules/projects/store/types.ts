export type ProjectStoreState = {
  projectId: string
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  togglePanel: () => void
}
