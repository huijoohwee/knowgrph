import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  resolveDefaultFlowWidgetPinnedInCanvas,
  resolveEffectiveFlowWidgetPinnedInCanvas,
} from '@/lib/flowEditor/widgetPlacementAuthority'

export function testFlowEditorWidgetDefaultsUseSharedPinHelper() {
  const innerPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorInner.tsx')
  const text = readFileSync(innerPath, 'utf8')
  if (!text.includes('flowWidgetPinnedByNodeId')) {
    throw new Error('expected NodeOverlayEditor to read pinned-by-node-id state from the graph store')
  }
  if (!text.includes('resolveEffectiveFlowWidgetPinnedInCanvas({')) {
    throw new Error('expected Flow widget default pinning to reuse the shared effective pin helper')
  }
  const surfaceElementsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorOverlaySurfaceElements.tsx')
  const surfaceElementsText = readFileSync(surfaceElementsPath, 'utf8')
  if (!surfaceElementsText.includes('useStableFrontmatterGraphAuthority')) {
    throw new Error('expected Flow Editor overlay elements to keep stable frontmatter graph authority during graph handoff')
  }
}

export function testFlowEditorFrontmatterWidgetsDefaultToFloatingScreenAuthority() {
  if (resolveDefaultFlowWidgetPinnedInCanvas({ graphMetaKind: 'frontmatter-flow' }) !== false) {
    throw new Error('expected frontmatter Flow Editor widgets to default to floating screen-space authority')
  }
  if (
    resolveEffectiveFlowWidgetPinnedInCanvas({
      graphMetaKind: 'frontmatter-flow',
      node: { id: 'any-text-widget', type: 'TextGeneration' },
      pinnedValue: true,
    }) !== false
  ) {
    throw new Error('expected frontmatter built-in widgets to reject stale pinned canvas state')
  }
  if (
    resolveEffectiveFlowWidgetPinnedInCanvas({
      graphMetaKind: 'frontmatter-flow',
      node: { id: 'any-widget', type: 'CustomFlowWidget' },
      pinnedValue: true,
    }) !== false
  ) {
    throw new Error('expected frontmatter widgets to reject stale canvas-pinned authority during recomposition')
  }
  if (resolveDefaultFlowWidgetPinnedInCanvas({ graphMetaKind: 'default-flow' }) !== true) {
    throw new Error('expected non-frontmatter Flow Editor widgets to keep pinned canvas defaults')
  }
}

export function testFlowEditorWidgetPinnedStateSubscribesToStoreUpdates() {
  const innerPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorInner.tsx')
  const text = readFileSync(innerPath, 'utf8')
  if (!text.includes('const unsub = useGraphStore.subscribe(')) {
    throw new Error('expected NodeOverlayEditor pinned state to subscribe to graph store updates')
  }
  if (!text.includes('setPinnedInCanvasState(prev => (prev === next ? prev : next))')) {
    throw new Error('expected NodeOverlayEditor to refresh pinned state when the graph store updates after mount')
  }
  if (!text.includes("pinnedValue: typeof v === 'boolean' ? v : null")) {
    throw new Error('expected NodeOverlayEditor pinned subscription to resolve raw store booleans through shared authority')
  }
}

export function testFlowEditorAutoRevealDoesNotForcePinFloatingWidgets() {
  const innerPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorInner.tsx')
  const text = readFileSync(innerPath, 'utf8')
  if (text.includes('if (forcePinnedToCanvas === true) setPinnedInCanvas(true)')) {
    throw new Error('expected auto-reveal to avoid legacy forced pinning for floating widgets')
  }
}
