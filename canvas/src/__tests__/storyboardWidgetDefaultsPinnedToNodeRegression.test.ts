import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  resolveDefaultFlowWidgetPinnedInCanvas,
  resolveEffectiveFlowWidgetPinnedInCanvas,
  stripFrontmatterAutoManagedWidgetPinnedStates,
} from '@/lib/storyboardWidget/widgetPlacementAuthority'

export function testStoryboardWidgetDefaultsUseSharedPinHelper() {
  const innerPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'WidgetEditorInner.tsx')
  const text = readFileSync(innerPath, 'utf8')
  if (!text.includes('flowWidgetPinnedByNodeId')) {
    throw new Error('expected WidgetEditor to read pinned-by-node-id state from the graph store')
  }
  if (!text.includes('resolveEffectiveFlowWidgetPinnedInCanvas({')) {
    throw new Error('expected Flow widget default pinning to reuse the shared effective pin helper')
  }
  const surfaceElementsPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'storyboardWidgetOverlaySurfaceElements.tsx')
  const surfaceElementsText = readFileSync(surfaceElementsPath, 'utf8')
  if (!surfaceElementsText.includes('useStableFrontmatterGraphAuthority')) {
    throw new Error('expected Storyboard Widget overlay elements to keep stable frontmatter graph authority during graph handoff')
  }
}

export function testStoryboardWidgetFrontmatterWidgetsDefaultToFloatingScreenAuthority() {
  if (resolveDefaultFlowWidgetPinnedInCanvas({ graphMetaKind: 'frontmatter-flow' }) !== false) {
    throw new Error('expected frontmatter Storyboard widgets to default to floating screen-space authority')
  }
  if (
    resolveEffectiveFlowWidgetPinnedInCanvas({
      graphMetaKind: 'frontmatter-flow',
      node: { id: 'any-text-widget', type: 'TextGeneration' },
      pinnedValue: true,
    }) !== true
  ) {
    throw new Error('expected frontmatter built-in widgets to honor explicit user pinned canvas state')
  }
  if (
    resolveEffectiveFlowWidgetPinnedInCanvas({
      graphMetaKind: 'frontmatter-flow',
      node: { id: 'any-widget', type: 'CustomFlowWidget' },
      pinnedValue: true,
    }) !== true
  ) {
    throw new Error('expected frontmatter custom widgets to honor explicit user pinned canvas state')
  }
  const stripped = stripFrontmatterAutoManagedWidgetPinnedStates({
    graphData: {
      type: 'Graph',
      context: 'frontmatter-flow',
      nodes: [
        { id: 'any-text-widget', type: 'TextGeneration', label: 'Text', properties: {} },
        { id: 'any-widget', type: 'CustomFlowWidget', label: 'Custom', properties: {} },
      ],
      edges: [],
      metadata: { kind: 'frontmatter-flow' },
    } as never,
    pinnedByNodeId: {
      'any-text-widget': true,
      'any-widget': true,
    },
  })
  if (stripped['any-text-widget'] === true) {
    throw new Error('expected graph commit/import cleanup to strip stale auto-managed frontmatter pinned residue')
  }
  if (stripped['any-widget'] !== true) {
    throw new Error('expected graph commit/import cleanup to preserve non-auto-managed frontmatter pinned state')
  }
  if (resolveDefaultFlowWidgetPinnedInCanvas({ graphMetaKind: 'default-flow' }) !== true) {
    throw new Error('expected non-frontmatter Storyboard widgets to keep pinned canvas defaults')
  }
}

export function testStoryboardWidgetPinnedStateSubscribesToStoreUpdates() {
  const innerPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'WidgetEditorInner.tsx')
  const overlayUiStatePath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'useWidgetEditorOverlayUiState.ts')
  const text = readFileSync(innerPath, 'utf8')
  const overlayUiStateText = readFileSync(overlayUiStatePath, 'utf8')
  if (!overlayUiStateText.includes('const unsub = useGraphStore.subscribe(')) {
    throw new Error('expected WidgetEditor pinned state to subscribe to graph store updates')
  }
  if (!overlayUiStateText.includes('setPinnedInCanvasState(prev => (prev === next ? prev : next))')) {
    throw new Error('expected WidgetEditor to refresh pinned state when the graph store updates after mount')
  }
  if (!overlayUiStateText.includes("pinnedValue: typeof v === 'boolean' ? v : null")) {
    throw new Error('expected WidgetEditor pinned subscription to resolve raw store booleans through shared authority')
  }
  if (!overlayUiStateText.includes('const requested = !!(typeof next === \'function\'')
    || !overlayUiStateText.includes('const resolved = resolveEffectiveFlowWidgetPinnedInCanvas({')
    || !overlayUiStateText.includes('const currentPinnedById = resolveScopedFlowWidgetNodeMap({')
    || !overlayUiStateText.includes('if (nextMap) setFlowWidgetPinnedByNodeIdForGraph(graphMetaKey, nextMap)')) {
    throw new Error('expected WidgetEditor pin persistence to store explicit user pin state through the scoped shared authority resolver')
  }
  if (!overlayUiStateText.includes('prev === true')
    || !overlayUiStateText.includes('const currentScreenPlacement = placement.readCurrentOverlayScreenPlacementForHandoff()')
    || !overlayUiStateText.includes('if (applied) placement.persistFloatingScreenPlacement({ top: applied.top, left: applied.left })')) {
    throw new Error('expected WidgetEditor unpin handoff to preserve the live Widget screen placement before changing pin state')
  }
  if (overlayUiStateText.includes('wasPinned && pinnedInCanvas !== true && floatingUsesScreenAuthority')) {
    throw new Error('expected WidgetEditor to avoid post-render unpin placement persistence that overwrites the pre-flip screen handoff')
  }
  if (!overlayUiStateText.includes("const domPinnedRaw = placement.asideRef.current?.getAttribute('data-kg-widget-pinned')")
    || !overlayUiStateText.includes('pinnedInCanvasRef.current = currentPinned')
    || !overlayUiStateText.includes('setPinnedInCanvas(!currentPinned)')) {
    throw new Error('expected WidgetEditor pin toggle to derive current pin state from the live Widget DOM before computing the next pin state')
  }
  if (overlayUiStateText.includes('const effectiveNext = resolveEffectiveFlowWidgetPinnedInCanvas({')
    || overlayUiStateText.includes('if (effectiveNext === pinnedInCanvasRef.current) {')) {
    throw new Error('expected WidgetEditor pin toggle to avoid treating explicit frontmatter pin requests as rejected stale residue')
  }
  if (!overlayUiStateText.includes('if (nodeId && useGraphStore.getState().flowWidgetDraggingNodeId === nodeId) {')
    || !overlayUiStateText.includes('useGraphStore.getState().setFlowWidgetDraggingNodeId(null)')) {
    throw new Error('expected WidgetEditor pin guard cleanup to clear stale dragging authority when a widget unmounts mid-toggle')
  }
}

export function testStoryboardWidgetAutoRevealDoesNotForcePinFloatingWidgets() {
  const innerPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'WidgetEditorInner.tsx')
  const text = readFileSync(innerPath, 'utf8')
  if (text.includes('if (forcePinnedToCanvas === true) setPinnedInCanvas(true)')) {
    throw new Error('expected auto-reveal to avoid legacy forced pinning for floating widgets')
  }
}
