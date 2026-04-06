import fs from 'node:fs'
import path from 'node:path'

export function testEditorWorkspaceSelectExitsMultiDimModeWhenSelectingEditor() {
  const filePath = path.resolve(process.cwd(), 'src', 'components', 'toolbar', 'EditorWorkspaceSelect.tsx')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })

  if (!text.includes('workspaceTablePreferencesStore.setWorkspaceEditorMode')) {
    throw new Error("expected selecting Editor workspace to reset workspaceEditorMode when it is 'multiDimTable'")
  }
  if (text.includes('setMultiDimTableModeEnabled')) {
    throw new Error('expected selecting Editor workspace to not mutate canvas multiDimTableModeEnabled')
  }
}
