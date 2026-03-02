import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorQuickEditorDefaultsPinnedInCanvas() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('flowNodeQuickEditorPinnedByNodeId')) {
    throw new Error('expected NodeOverlayEditor to read pinned-by-node-id state from the graph store')
  }
  if (!text.includes("return typeof v === 'boolean' ? v : true")) {
    throw new Error('expected Flow node quick editor to default pinned-in-canvas when no prior preference exists')
  }
}
