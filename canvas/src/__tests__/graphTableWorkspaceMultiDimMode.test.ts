import fs from 'node:fs'
import path from 'node:path'

export function testGraphTableWorkspacePreservesMultiDimWorkspaceMode() {
  const filePath = path.resolve(process.cwd(), 'src', 'lib', 'graph-table', 'ui', 'GraphTableWorkspace.impl.tsx')
  const workspaceModePath = path.resolve(process.cwd(), 'src', 'features', 'workspace-table', 'workspaceEditorMode.ts')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })
  const workspaceModeText = fs.readFileSync(workspaceModePath, { encoding: 'utf8' })

  if (!text.includes('toWorkspaceBackedTableViewMode(workspaceTablePreferencesStore.getSnapshot().workspaceEditorMode)')) {
    throw new Error("expected GraphTableWorkspace to initialize view mode from the shared workspace->table mode mapper")
  }
  if (!text.includes('const next = toWorkspaceBackedTableViewMode(workspaceEditorMode)')) {
    throw new Error("expected GraphTableWorkspace to reuse the shared workspace->table mode mapper during preference updates")
  }
  if (!text.includes('toWorkspaceEditorModeFromTableViewMode(next)')) {
    throw new Error("expected GraphTableWorkspace view-mode handler to reuse the shared table->workspace mode mapper")
  }
  if (!workspaceModeText.includes('export function toWorkspaceBackedTableViewMode(')) {
    throw new Error('expected workspace editor mode module to expose the shared workspace->table mode mapper')
  }
  if (!workspaceModeText.includes('export function toWorkspaceEditorModeFromTableViewMode(')) {
    throw new Error('expected workspace editor mode module to expose the shared table->workspace mode mapper')
  }
}

export function testWorkspaceTableViewModeSupportsMultiDimTableSsot() {
  const headerPath = path.resolve(process.cwd(), 'src', 'features', 'graph-table', 'ui', 'GraphTableWorkspaceHeader.tsx')
  const workspaceModePath = path.resolve(process.cwd(), 'src', 'features', 'workspace-table', 'workspaceEditorMode.ts')
  const presentationPath = path.resolve(process.cwd(), 'src', 'features', 'workspace-table', 'workspaceEditorModePresentation.ts')
  const headerText = fs.readFileSync(headerPath, { encoding: 'utf8' })
  const workspaceModeText = fs.readFileSync(workspaceModePath, { encoding: 'utf8' })
  const presentationText = fs.readFileSync(presentationPath, { encoding: 'utf8' })

  if (!workspaceModeText.includes("export type WorkspaceTableViewMode = WorkspaceEditorMode | 'geospatial'")) {
    throw new Error("expected WorkspaceTableViewMode to keep workspace-backed modes and the geospatial overlay mode in the shared workspace-table SSOT")
  }
  if (!workspaceModeText.includes("if (raw === 'table' || raw === 'multiDimTable' || raw === 'kanban') return raw")) {
    throw new Error("expected parseWorkspaceEditorMode to accept 'multiDimTable' without graph-table-local parsing")
  }
  if (!presentationText.includes('WORKSPACE_TABLE_VIEW_MODE_SELECT_OPTIONS')) {
    throw new Error("expected shared workspace-table presentation options to expose table view labels")
  }
  if (!headerText.includes('WORKSPACE_TABLE_VIEW_MODE_SELECT_OPTIONS')) {
    throw new Error("expected GraphTableWorkspaceHeader to reuse shared workspace-table view options")
  }
  if (workspaceModeText.includes('graphTableViewMode') || headerText.includes('graphTableViewMode')) {
    throw new Error("expected workspace table view mode to avoid duplicate graphTableViewMode persistence")
  }
}
