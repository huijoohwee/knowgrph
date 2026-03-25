import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphTableDbSyncDoesNotUseModuleGlobalKeyGuards() {
  const p = resolve(process.cwd(), 'src', 'features', 'graph-table', 'hooks', 'useGraphTableDbSync.ts')
  const text = readFileSync(p, 'utf8')
  if (text.includes('lastSyncedKeyGlobal') || text.includes('lastGraphWriteKeyGlobal')) {
    throw new Error('expected useGraphTableDbSync to avoid module-global key guards')
  }
  if (!text.includes('syncGateByViewKey') || !text.includes('new Map')) {
    throw new Error('expected useGraphTableDbSync to use a viewKey-scoped sync gate')
  }
}

export function testGraphTableSelectionInspectorGatesDbSyncWhenGraphTablePaneIsActive() {
  const p = resolve(process.cwd(), 'src', 'features', 'graph-table', 'ui', 'GraphTableSelectionInspector.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('editorWorkspacePane') || !text.includes("workspaceViewMode")) {
    throw new Error('expected GraphTableSelectionInspector to read editor workspace state')
  }
  if (!text.includes('syncEnabled') || !text.includes("editorWorkspacePane !== 'graphTable'")) {
    throw new Error('expected GraphTableSelectionInspector to disable sync when graphTable pane is active')
  }
}

export function testOverlayInteractions2dCleanupCancelsActiveDrags() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useOverlayInteractions2d.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('return () =>') || !text.includes('cancelAllInteractions()')) {
    throw new Error('expected useOverlayInteractions2d cleanup to cancel active interactions')
  }
}

