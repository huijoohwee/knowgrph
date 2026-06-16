import fs from 'node:fs'
import path from 'node:path'

export function testDocumentModeSelectMultiDimIsCanvasModeOnly() {
  const filePath = path.resolve(process.cwd(), 'src', 'components', 'toolbar', 'DocumentModeSelect.tsx')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })
  const removedWorkspaceOpenFn = ['openWorkspace', 'Table'].join('')
  const removedWorkspaceStateFn = ['isWorkspace', 'TableOpen'].join('')

  if (text.includes(removedWorkspaceOpenFn) || text.includes(removedWorkspaceStateFn)) {
    throw new Error('expected DocumentModeSelect multi-d mode to not open the workspace table')
  }
  if (!text.includes('UI_LABELS.multiDimTableMode')) {
    throw new Error("expected DocumentModeSelect multi-d option label to use UI_LABELS.multiDimTableMode")
  }
  if (!text.includes('UI_COPY.multiDimTableModeTooltip')) {
    throw new Error('expected DocumentModeSelect multi-d option tooltip to use UI_COPY.multiDimTableModeTooltip')
  }
}
