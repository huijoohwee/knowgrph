import fs from 'node:fs'
import path from 'node:path'

export function testEditorWorkspaceSelectEntersMultiDimModeWhenSelectingMultiDimTable() {
  const filePath = path.resolve(process.cwd(), 'src', 'components', 'toolbar', 'EditorWorkspaceSelect.tsx')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })

  if (!text.includes("workspaceTablePreferencesStore.setWorkspaceEditorMode('multiDimTable')")) {
    throw new Error("expected selecting Multi-dimensional Table to set workspaceEditorMode to 'multiDimTable'")
  }
  if (text.includes('setMultiDimTableModeEnabled')) {
    throw new Error('expected selecting Workspace multi-d table to not toggle canvas multiDimTableModeEnabled')
  }
}
