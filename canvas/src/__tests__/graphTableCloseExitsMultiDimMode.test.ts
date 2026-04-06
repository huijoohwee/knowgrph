import fs from 'node:fs'
import path from 'node:path'

export function testClosingGraphTableResetsWorkspaceEditorModeWithoutTouchingCanvasModes() {
  const filePath = path.resolve(process.cwd(), 'src', 'features', 'graph-table', 'ui', 'GraphTableWorkspace.tsx')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })

  if (!text.includes("setWorkspaceEditorMode('table')") && !text.includes('setWorkspaceEditorMode("table")')) {
    throw new Error("expected GraphTableWorkspace close handler to reset workspaceEditorMode from 'multiDimTable'")
  }
  if (text.includes('setMultiDimTableModeEnabled')) {
    throw new Error('expected GraphTableWorkspace close handler to not mutate canvas multiDimTableModeEnabled')
  }
}
