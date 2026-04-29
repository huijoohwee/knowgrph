import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorWidgetDefaultsUseSharedPinHelper() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('flowWidgetPinnedByNodeId')) {
    throw new Error('expected NodeOverlayEditor to read pinned-by-node-id state from the graph store')
  }
  if (!text.includes('resolveDefaultFlowWidgetPinnedInCanvas({ graphMetaKind })')) {
    throw new Error('expected Flow widget default pinning to reuse the shared graph-kind pin helper')
  }
}

export function testFlowEditorWidgetPinnedStateSubscribesToStoreUpdates() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('const unsub = useGraphStore.subscribe(')) {
    throw new Error('expected NodeOverlayEditor pinned state to subscribe to graph store updates')
  }
  if (!text.includes('setPinnedInCanvasState(prev => (prev === next ? prev : next))')) {
    throw new Error('expected NodeOverlayEditor to refresh pinned state when the graph store updates after mount')
  }
}

export function testFlowEditorAutoRevealDoesNotForcePinFloatingWidgets() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('if (forcePinnedToCanvas === true) setPinnedInCanvas(true)')) {
    throw new Error('expected auto-reveal to avoid legacy forced pinning for floating widgets')
  }
}
