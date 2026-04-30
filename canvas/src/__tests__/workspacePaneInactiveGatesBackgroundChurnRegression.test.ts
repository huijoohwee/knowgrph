import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testEmbeddedEditorShellPassesActiveToMarkdownWorkspace() {
  const p = resolve(process.cwd(), 'src', 'components', 'EmbeddedEditorShell.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('<MarkdownWorkspaceLazy active=')) {
    throw new Error('expected EmbeddedEditorShell to pass active flag to MarkdownWorkspace')
  }
}

export function testGraphTableWorkspaceGatesRxdbSubscriptionsByActive() {
  const p = resolve(process.cwd(), 'src', 'lib', 'graph-table', 'ui', 'GraphTableWorkspace.impl.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('if (!active) return')) {
    throw new Error('expected GraphTableWorkspace to gate rxdb subscriptions when inactive')
  }
  if (!text.includes('}, [active, activeTableId])')) {
    throw new Error('expected GraphTableWorkspace rxdb effect to depend on active')
  }
}

