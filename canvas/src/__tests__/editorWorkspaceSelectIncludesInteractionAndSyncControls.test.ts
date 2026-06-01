import fs from 'node:fs'
import path from 'node:path'

export function testEditorWorkspaceSelectIncludesInteractionAndSyncControls() {
  const filePath = path.resolve(process.cwd(), 'src', 'components', 'toolbar', 'EditorWorkspaceSelect.tsx')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })

  if (!text.includes('UI_LABELS.workspaceSyncMode')) {
    throw new Error('expected EditorWorkspaceSelect dropdown to include workspace sync mode control')
  }
  if (!text.includes('UI_LABELS.storageSync')) {
    throw new Error('expected EditorWorkspaceSelect dropdown to include storage sync control below workspace sync mode')
  }
  if (!text.includes('readWorkspaceSeedSyncEnabledSetting') || !text.includes('writeWorkspaceSeedSyncEnabledSetting')) {
    throw new Error('expected storage sync toolbar control to reuse the shared workspace storage-sync setting')
  }
  if (text.indexOf('UI_LABELS.storageSync') <= text.indexOf('UI_LABELS.workspaceSyncMode')) {
    throw new Error('expected storage sync control to render below workspace sync mode')
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
