import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorFlyoutOverlayRootHasWidgetDataAttr() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('<aside')) {
    throw new Error('expected NodeOverlayEditor to render an aside root')
  }
  if (!text.includes('data-kg-widget')) {
    throw new Error('expected NodeOverlayEditor fly-out overlay root to include data-kg-widget for event proxy')
  }
}

