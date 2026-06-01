import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testEmbeddedEditorShellPassesActiveToMarkdownWorkspace() {
  const p = resolve(process.cwd(), 'src', 'components', 'EmbeddedEditorShell.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('<MarkdownWorkspaceLazy active=')) {
    throw new Error('expected EmbeddedEditorShell to pass active flag to MarkdownWorkspace')
  }
}

export function testGraphTableWorkspaceGatesPersistedCollectionSubscriptionsByActive() {
  const p = resolve(process.cwd(), 'src', 'lib', 'graph-table', 'ui', 'GraphTableWorkspace.impl.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('if (!active) return')) {
    throw new Error('expected GraphTableWorkspace to gate persisted-collection subscriptions when inactive')
  }
  if (!text.includes('[active, activeTableId,')) {
    throw new Error('expected GraphTableWorkspace subscription effect to depend on active')
  }
}

export function testWorkspaceOpenCanvasToolbarDoesNotCoverEditorPaneControls() {
  const p = resolve(process.cwd(), 'src', 'pages', 'Canvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('className="kg-workspace-overlay-canvas-toolbar')) {
    throw new Error('expected workspace-open canvas toolbar to remain identifiable at its shared owner')
  }
  if (!text.includes('style={{ left: workspacePaneBoundaryCss }}')) {
    throw new Error('expected workspace-open canvas toolbar to start at the workspace pane boundary instead of covering editor controls')
  }
}
