import fs from 'node:fs'
import path from 'node:path'

export function testGraphTableWorkspacePreservesMultiDimWorkspaceMode() {
  const filePath = path.resolve(process.cwd(), 'src', 'lib', 'graph-table', 'ui', 'GraphTableWorkspace.impl.tsx')
  const workspaceModePath = path.resolve(process.cwd(), 'src', 'features', 'workspace-table', 'workspaceEditorMode.ts')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })
  const workspaceModeText = fs.readFileSync(workspaceModePath, { encoding: 'utf8' })

  if (!text.includes('toWorkspaceBackedGraphTableViewMode(workspaceTablePreferencesStore.getSnapshot().workspaceEditorMode)')) {
    throw new Error("expected GraphTableWorkspace to initialize view mode from the shared workspace->table mode mapper")
  }
  if (!text.includes('const next = toWorkspaceBackedGraphTableViewMode(workspaceEditorMode)')) {
    throw new Error("expected GraphTableWorkspace to reuse the shared workspace->table mode mapper during preference updates")
  }
  if (!text.includes('toWorkspaceEditorModeFromGraphTableViewMode(next)')) {
    throw new Error("expected GraphTableWorkspace view-mode handler to reuse the shared table->workspace mode mapper")
  }
  if (!workspaceModeText.includes('export function toWorkspaceBackedGraphTableViewMode(')) {
    throw new Error('expected workspace editor mode module to expose the shared workspace->table mode mapper')
  }
  if (!workspaceModeText.includes('export function toWorkspaceEditorModeFromGraphTableViewMode(')) {
    throw new Error('expected workspace editor mode module to expose the shared table->workspace mode mapper')
  }
}

export function testGraphTableViewModeSupportsMultiDimTableSsot() {
  const viewModePath = path.resolve(process.cwd(), 'src', 'features', 'graph-table', 'ui', 'graphTableViewMode.ts')
  const headerPath = path.resolve(process.cwd(), 'src', 'features', 'graph-table', 'ui', 'GraphTableWorkspaceHeader.tsx')
  const workspaceModePath = path.resolve(process.cwd(), 'src', 'features', 'workspace-table', 'workspaceEditorMode.ts')
  const viewModeText = fs.readFileSync(viewModePath, { encoding: 'utf8' })
  const headerText = fs.readFileSync(headerPath, { encoding: 'utf8' })
  const workspaceModeText = fs.readFileSync(workspaceModePath, { encoding: 'utf8' })

  if (!viewModeText.includes("export type GraphTableViewMode = 'table' | 'multiDimTable' | 'kanban' | 'geospatial'")) {
    throw new Error("expected GraphTableViewMode to keep workspace-backed modes and the geospatial overlay mode in one SSOT")
  }
  if (!viewModeText.includes("if (raw === 'table' || raw === 'multiDimTable' || raw === 'kanban') return raw")) {
    throw new Error("expected parseGraphTableViewMode to accept 'multiDimTable'")
  }
  if (!headerText.includes("{ value: 'multiDimTable', label: UI_COPY.markdownDataViewTitleDefault }")) {
    throw new Error("expected GraphTableWorkspaceHeader to expose a Multi-dimensional Table view option")
  }
  if (!workspaceModeText.includes('toWorkspaceEditorModeFromGraphTableViewMode(graphTableView)')) {
    throw new Error("expected readWorkspaceEditorMode to normalize graphTableViewMode via the shared table->workspace mapper")
  }
  if (!workspaceModeText.includes('const nextGraphTableMode = toWorkspaceBackedGraphTableViewMode(mode)')) {
    throw new Error("expected writeWorkspaceEditorMode to persist graphTableViewMode via the shared workspace->table mapper")
  }
}
