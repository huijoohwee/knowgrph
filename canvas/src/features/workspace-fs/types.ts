export type WorkspaceEntryKind = 'file' | 'folder'

export type WorkspacePath = string

export type WorkspaceEntry = {
  path: WorkspacePath
  parentPath: WorkspacePath | null
  kind: WorkspaceEntryKind
  name: string
  text?: string
  updatedAtMs: number
}

export type WorkspaceFs = {
  ensureSeed: () => Promise<boolean>
  listEntries: () => Promise<WorkspaceEntry[]>
  readFileText: (path: WorkspacePath) => Promise<string | null>
  writeFileText: (path: WorkspacePath, text: string) => Promise<void>
  createFile: (args: { parentPath: WorkspacePath; name: string; text: string }) => Promise<WorkspacePath>
  createFolder: (args: { parentPath: WorkspacePath; name: string }) => Promise<WorkspacePath>
  deleteEntry: (path: WorkspacePath) => Promise<void>
}

export type WorkspaceOutlineItem = {
  id: string
  text: string
  level: number
  line: number
}

export type WorkspaceBacklink = {
  fromPath: WorkspacePath
  line: number
  lineText: string
}
