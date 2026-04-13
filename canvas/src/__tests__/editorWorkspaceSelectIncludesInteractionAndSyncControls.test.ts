import fs from 'node:fs'
import path from 'node:path'

export function testEditorWorkspaceSelectIncludesInteractionAndSyncControls() {
  const filePath = path.resolve(process.cwd(), 'src', 'components', 'toolbar', 'EditorWorkspaceSelect.tsx')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })

  if (!text.includes('UI_LABELS.canvasInteractionMode')) {
    throw new Error('expected EditorWorkspaceSelect dropdown to include canvas interaction mode control')
  }
  if (!text.includes('UI_LABELS.workspaceSyncMode')) {
    throw new Error('expected EditorWorkspaceSelect dropdown to include workspace sync mode control')
  }
}

export function testToolbarRemovesStandaloneInteractionAndSyncButtons() {
  const filePath = path.resolve(process.cwd(), 'src', 'components', 'Toolbar.tsx')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })

  if (text.includes('title={UI_LABELS.canvasInteractionMode}')) {
    throw new Error('expected Toolbar to remove standalone canvas interaction mode button')
  }
  if (text.includes('title={UI_LABELS.workspaceSyncMode}')) {
    throw new Error('expected Toolbar to remove standalone workspace sync mode button')
  }
  if (!text.includes('ensureBaselineUnlocked={ensureBaselineUnlocked}')) {
    throw new Error('expected Toolbar to pass baseline lock guard into EditorWorkspaceSelect')
  }
}
