import fs from 'node:fs'
import path from 'node:path'

export function testGraphTableWorkspacePreservesMultiDimWorkspaceMode() {
  const filePath = path.resolve(process.cwd(), 'src', 'lib', 'graph-table', 'ui', 'GraphTableWorkspace.impl.tsx')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })

  if (!text.includes("if (mode === 'multiDimTable') return 'multiDimTable'")) {
    throw new Error("expected GraphTableWorkspace to preserve workspaceEditorMode='multiDimTable' during initial view-mode sync")
  }
  if (!text.includes("workspaceEditorMode === 'multiDimTable' ? 'multiDimTable' : 'table'")) {
    throw new Error("expected GraphTableWorkspace to keep multiDimTable during workspace preference updates")
  }
  if (!text.includes("if (next === 'multiDimTable')")) {
    throw new Error("expected GraphTableWorkspace view-mode handler to branch on 'multiDimTable'")
  }
  if (!text.includes("workspaceTablePreferencesStore.setWorkspaceEditorMode('multiDimTable')")) {
    throw new Error("expected GraphTableWorkspace view-mode handler to write workspaceEditorMode='multiDimTable'")
  }
}

export function testGraphTableViewModeSupportsMultiDimTableSsot() {
  const viewModePath = path.resolve(process.cwd(), 'src', 'features', 'graph-table', 'ui', 'graphTableViewMode.ts')
  const headerPath = path.resolve(process.cwd(), 'src', 'features', 'graph-table', 'ui', 'GraphTableWorkspaceHeader.tsx')
  const workspaceModePath = path.resolve(process.cwd(), 'src', 'features', 'workspace-table', 'workspaceEditorMode.ts')
  const viewModeText = fs.readFileSync(viewModePath, { encoding: 'utf8' })
  const headerText = fs.readFileSync(headerPath, { encoding: 'utf8' })
  const workspaceModeText = fs.readFileSync(workspaceModePath, { encoding: 'utf8' })

  if (!viewModeText.includes("export type GraphTableViewMode = 'table' | 'multiDimTable' | 'kanban'")) {
    throw new Error("expected GraphTableViewMode to include 'multiDimTable'")
  }
  if (!viewModeText.includes("if (raw === 'table' || raw === 'multiDimTable' || raw === 'kanban') return raw")) {
    throw new Error("expected parseGraphTableViewMode to accept 'multiDimTable'")
  }
  if (!headerText.includes("{ value: 'multiDimTable', label: UI_COPY.markdownDataViewTitleDefault }")) {
    throw new Error("expected GraphTableWorkspaceHeader to expose a Multi-dimensional Table view option")
  }
  if (!workspaceModeText.includes("graphTableView === 'multiDimTable' ? 'multiDimTable' : 'table'")) {
    throw new Error("expected readWorkspaceEditorMode to preserve graphTableViewMode='multiDimTable'")
  }
  if (!workspaceModeText.includes("mode === 'multiDimTable' ? 'multiDimTable' : 'table'")) {
    throw new Error("expected writeWorkspaceEditorMode to persist graphTableViewMode='multiDimTable'")
  }
}
