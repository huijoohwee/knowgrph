import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import {
  collectCanonicalFlowEditorOverlayRectEntries,
  FLOW_EDITOR_OVERLAY_ROOT_SELECTOR,
  FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR,
  readFlowEditorOverlaySurfaceId,
} from '@/lib/canvas/flow-editor-overlay-proxy'

export async function testFlowEditorActiveSurfaceObstacleCollectionIsSurfaceBoundedAndCanonical() {
  const { dom, restore } = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    const doc = dom.window.document
    const body = doc.body

    const surfaceA = doc.createElement('section')
    surfaceA.setAttribute(FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR, 'surface-a')
    body.appendChild(surfaceA)

    const surfaceB = doc.createElement('section')
    surfaceB.setAttribute(FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR, 'surface-b')
    body.appendChild(surfaceB)

    const makeOverlay = (args: {
      parent: HTMLElement
      surfaceId: string
      nodeId: string
      widgetId?: string
      richMedia?: boolean
      left: number
      top: number
      width: number
      height: number
    }) => {
      const el = doc.createElement('div')
      el.setAttribute('data-kg-flow-editor-mode', '1')
      el.setAttribute('data-kg-flow-editor-surface', args.surfaceId)
      if (args.widgetId) el.setAttribute('data-kg-widget', args.widgetId)
      else el.setAttribute('data-node-id', args.nodeId)
      if (args.richMedia) el.setAttribute('data-kg-rich-media-overlay', '1')
      ;(el as unknown as { dataset: DOMStringMap }).dataset.nodeId = args.nodeId
      ;(el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () => ({
        left: args.left,
        top: args.top,
        width: args.width,
        height: args.height,
        right: args.left + args.width,
        bottom: args.top + args.height,
        x: args.left,
        y: args.top,
        toJSON: () => ({}),
      }) as DOMRect
      args.parent.appendChild(el)
      return el
    }

    makeOverlay({
      parent: surfaceA,
      surfaceId: 'surface-a',
      nodeId: 'shared-node',
      richMedia: true,
      left: 20,
      top: 20,
      width: 120,
      height: 80,
    })
    makeOverlay({
      parent: surfaceA,
      surfaceId: 'surface-a',
      nodeId: 'shared-node',
      widgetId: 'shared-node',
      left: 24,
      top: 24,
      width: 220,
      height: 160,
    })
    makeOverlay({
      parent: surfaceA,
      surfaceId: 'surface-a',
      nodeId: 'only-a',
      widgetId: 'only-a',
      left: 300,
      top: 80,
      width: 180,
      height: 120,
    })
    makeOverlay({
      parent: surfaceB,
      surfaceId: 'surface-b',
      nodeId: 'only-b',
      widgetId: 'only-b',
      left: 600,
      top: 100,
      width: 180,
      height: 120,
    })

    const queryActiveSurfaceOverlays = (surfaceId: string): HTMLElement[] => {
      const surfaceRoot = doc.querySelector<HTMLElement>(`[${FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR}="${surfaceId}"]`)
      const queryRoot: ParentNode = surfaceRoot || doc
      return Array.from(queryRoot.querySelectorAll<HTMLElement>(FLOW_EDITOR_OVERLAY_ROOT_SELECTOR))
        .filter(el => readFlowEditorOverlaySurfaceId(el) === surfaceId)
    }

    const surfaceAEntries = collectCanonicalFlowEditorOverlayRectEntries(queryActiveSurfaceOverlays('surface-a'))
    const surfaceBEntries = collectCanonicalFlowEditorOverlayRectEntries(queryActiveSurfaceOverlays('surface-b'))

    if (surfaceAEntries.length !== 2) {
      throw new Error(`expected surface-a canonical obstacle collection to return 2 entries, got ${surfaceAEntries.length}`)
    }
    if (surfaceBEntries.length !== 1) {
      throw new Error(`expected surface-b canonical obstacle collection to return 1 entry, got ${surfaceBEntries.length}`)
    }

    const sharedNodeEntry = surfaceAEntries.find(entry => entry.id === 'shared-node')
    if (!sharedNodeEntry) {
      throw new Error('expected surface-a canonical obstacle collection to include shared-node')
    }
    if (Math.round(sharedNodeEntry.rect.width) !== 220 || Math.round(sharedNodeEntry.rect.height) !== 160) {
      throw new Error(
        `expected surface-a canonical obstacle collection to prefer the larger widget-shell rect, got ${sharedNodeEntry.rect.width}x${sharedNodeEntry.rect.height}`,
      )
    }
    if (surfaceAEntries.some(entry => entry.id === 'only-b')) {
      throw new Error('expected surface-a canonical obstacle collection to exclude overlays from other active surfaces')
    }
    if (surfaceBEntries.some(entry => entry.id === 'shared-node' || entry.id === 'only-a')) {
      throw new Error('expected surface-b canonical obstacle collection to exclude overlays from surface-a')
    }
  } finally {
    restore()
  }
}
