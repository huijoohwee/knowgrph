import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowNodeQuickEditorFrontmatterPadAccountsForPortHandles() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const text = readFileSync(p, 'utf8')

  if (!text.includes("String(graphMetaKind || '').trim() === 'frontmatter-flow'")) {
    throw new Error('expected NodeOverlayEditor to treat frontmatter-flow as port-handles enabled')
  }
  if (!text.includes('readPortHandleUiMetrics')) {
    throw new Error('expected NodeOverlayEditor to use port handle UI metrics when anchoring overlays')
  }
}
