import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorFrontmatterFlowAutoShowsWidgets() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(p, 'utf8')

  if (!text.includes("kind === 'frontmatter-flow'")) {
    throw new Error("expected FlowEditorCanvas to auto-show widgets for frontmatter-flow graphs")
  }
  if (!text.includes('allowedFlowNodeIds')) {
    throw new Error('expected FlowEditorCanvas frontmatter-flow widget derivation to use explicit flow node id registry scoping')
  }

  if (!text.includes('const overlayOnlyModeEnabled') || !text.includes('return flowEditorViewActive')) {
    throw new Error('expected FlowEditorCanvas overlay-only mode to stay view-scoped and independent from edit lock state')
  }

  if (!text.includes('if (allowedFlowNodeIds.size === 0) return []')) {
    throw new Error('expected FlowEditorCanvas to avoid synthetic widget fallback when flow registry ids are absent')
  }
  if (!text.includes('if (flowEditorFrontmatterGraphAvailable) return []')) {
    throw new Error('expected FlowEditorCanvas to avoid stale openWidget fallback while frontmatter-flow graph activation settles')
  }
  if (!text.includes('if (flowEditorFrontmatterGraphAvailable) return')) {
    throw new Error('expected FlowEditorCanvas to skip broad widget id seeding for frontmatter-flow families')
  }
  if (!text.includes("if (kind === 'frontmatter-flow') return")) {
    throw new Error('expected FlowEditorCanvas to avoid broad widget id seeding when draft graph kind is frontmatter-flow')
  }

  if (!text.includes('if (!flowEditorViewActive) return []')) {
    throw new Error('expected FlowEditorCanvas widget overlays to remain Flow Editor view-scoped')
  }
}
