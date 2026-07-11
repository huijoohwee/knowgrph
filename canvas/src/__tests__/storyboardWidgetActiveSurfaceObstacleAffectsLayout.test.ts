import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { defaultSchema } from '@/lib/graph/schema'
import { startMediaOverlayLayoutLoop2d } from '@/lib/render/mediaOverlayLayoutLoop2d'
import {
  collectCanonicalStoryboardWidgetOverlayRectEntries,
  STORYBOARD_WIDGET_OVERLAY_ROOT_SELECTOR,
  STORYBOARD_WIDGET_OVERLAY_SURFACE_ROOT_ATTR,
  readStoryboardWidgetOverlaySurfaceId,
} from '@/lib/canvas/storyboard-widget-overlay-proxy'

function setFixedRect(el: HTMLElement, args: {
  left: number
  top: number
  width: number
  height: number
}) {
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
}

function readVectorPaintedPanelBox(el: HTMLElement): { left: number; top: number; width: number; height: number } {
  if (String(el.style.transform || '') !== 'none') throw new Error(`expected vector-painted panel transform=none, got ${el.style.transform || '(empty)'}`)
  const left = Number.parseFloat(el.style.left || 'NaN')
  const top = Number.parseFloat(el.style.top || 'NaN')
  const scale = Number.parseFloat(String((el.style as CSSStyleDeclaration & { zoom?: string }).zoom || '1'))
  const width = Number.parseFloat(el.style.width || 'NaN')
  const height = Number.parseFloat(el.style.height || 'NaN')
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1
  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`expected finite vector-painted overlay box, got ${JSON.stringify({ left, top, width, height })}`)
  }
  return { left, top, width: width * safeScale, height: height * safeScale }
}

export function testStoryboardWidgetCanonicalOverlayRectEntriesSkipTransientOffscreenRichMediaBeforeRank() {
  const { dom, restore } = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    const doc = dom.window.document
    const transient = doc.createElement('article')
    transient.setAttribute('data-kg-storyboard-widget-mode', '1')
    transient.setAttribute('data-kg-storyboard-widget-surface', 'surface-a')
    transient.setAttribute('data-kg-rich-media-overlay', '1')
    transient.setAttribute('data-node-id', 'media-a')
    setFixedRect(transient, { left: -20000, top: -20000, width: 1, height: 1 })

    const visiblePinnedProxy = doc.createElement('article')
    visiblePinnedProxy.setAttribute('data-kg-storyboard-widget-mode', '1')
    visiblePinnedProxy.setAttribute('data-kg-storyboard-widget-surface', 'surface-a')
    visiblePinnedProxy.setAttribute('data-kg-rich-media-overlay', '1')
    visiblePinnedProxy.setAttribute('data-kg-canvas-overlay-pinned', '1')
    visiblePinnedProxy.setAttribute('data-node-id', 'media-a')
    setFixedRect(visiblePinnedProxy, { left: 120, top: 80, width: 320, height: 180 })

    const entries = collectCanonicalStoryboardWidgetOverlayRectEntries([
      transient,
      visiblePinnedProxy,
    ])
    if (entries.length !== 1) {
      throw new Error(`expected one canonical rich-media overlay entry, got ${entries.length}`)
    }
    const entry = entries[0]!
    if (entry.el !== visiblePinnedProxy) {
      throw new Error('expected transient offscreen rich-media bootstrap root to be skipped before rank comparison')
    }
    if (entry.rect.left !== 120 || entry.rect.top !== 80 || entry.rect.width !== 320 || entry.rect.height !== 180) {
      throw new Error(`expected visible rich-media proxy rect to own canonical geometry, got ${JSON.stringify({
        left: entry.rect.left,
        top: entry.rect.top,
        width: entry.rect.width,
        height: entry.rect.height,
      })}`)
    }
  } finally {
    restore()
  }
}

export function testPinnedRichMediaRectBeatsFullscreenSemanticProxy() {
  const { dom, restore } = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    const doc = dom.window.document
    const semanticProxy = doc.createElement('section')
    semanticProxy.setAttribute('data-kg-storyboard-widget-surface', 'surface-a')
    semanticProxy.setAttribute('data-node-id', 'media-a')
    setFixedRect(semanticProxy, { left: 0, top: 0, width: 1113, height: 998 })

    const pinnedPanel = doc.createElement('section')
    pinnedPanel.setAttribute('data-kg-storyboard-widget-mode', '1')
    pinnedPanel.setAttribute('data-kg-storyboard-widget-surface', 'surface-a')
    pinnedPanel.setAttribute('data-kg-rich-media-overlay', '1')
    pinnedPanel.setAttribute('data-kg-canvas-overlay-pinned', '1')
    pinnedPanel.setAttribute('data-node-id', 'media-a')
    setFixedRect(pinnedPanel, { left: 376, top: 788, width: 196, height: 109 })

    const entries = collectCanonicalStoryboardWidgetOverlayRectEntries([semanticProxy, pinnedPanel])
    const entry = entries[0] || null
    if (entries.length !== 1 || entry?.el !== pinnedPanel) {
      throw new Error('expected the visible pinned Rich Media Panel to own edge-anchor geometry over a fullscreen semantic proxy')
    }
  } finally {
    restore()
  }
}

export async function testStoryboardWidgetActiveSurfaceObstaclesAffectFinalRichMediaLayoutPlacement() {
  const { dom, restore } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    const doc = dom.window.document
    const root = doc.getElementById('root')
    if (!root) throw new Error('expected root container')

    const surfaceA = doc.createElement('section')
    surfaceA.setAttribute(STORYBOARD_WIDGET_OVERLAY_SURFACE_ROOT_ATTR, 'surface-a')
    doc.body.appendChild(surfaceA)

    const surfaceB = doc.createElement('section')
    surfaceB.setAttribute(STORYBOARD_WIDGET_OVERLAY_SURFACE_ROOT_ATTR, 'surface-b')
    doc.body.appendChild(surfaceB)

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
      const el = doc.createElement('section')
      el.setAttribute('data-kg-storyboard-widget-mode', '1')
      el.setAttribute('data-kg-storyboard-widget-surface', args.surfaceId)
      if (args.widgetId) el.setAttribute('data-kg-widget', args.widgetId)
      else el.setAttribute('data-node-id', args.nodeId)
      if (args.richMedia) el.setAttribute('data-kg-rich-media-overlay', '1')
      ;(el as unknown as { dataset: DOMStringMap }).dataset.nodeId = args.nodeId
      setFixedRect(el, args)
      args.parent.appendChild(el)
      return el
    }

    makeOverlay({
      parent: surfaceA,
      surfaceId: 'surface-a',
      nodeId: 'widget-a',
      widgetId: 'widget-a',
      left: 350,
      top: 170,
      width: 260,
      height: 180,
    })
    makeOverlay({
      parent: surfaceB,
      surfaceId: 'surface-b',
      nodeId: 'widget-b',
      widgetId: 'widget-b',
      left: 40,
      top: 40,
      width: 320,
      height: 220,
    })

    const ids = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']
    const els = new Map<string, HTMLElement>()
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i]!
      const el = doc.createElement('section')
      root.appendChild(el)
      els.set(id, el)
    }

    const queryActiveSurfaceOverlays = (surfaceId: string): HTMLElement[] => {
      const surfaceRoot = doc.querySelector<HTMLElement>(`[${STORYBOARD_WIDGET_OVERLAY_SURFACE_ROOT_ATTR}="${surfaceId}"]`)
      const queryRoot: ParentNode = surfaceRoot || doc
      return Array.from(queryRoot.querySelectorAll<HTMLElement>(STORYBOARD_WIDGET_OVERLAY_ROOT_SELECTOR))
        .filter(el => readStoryboardWidgetOverlaySurfaceId(el) === surfaceId)
    }

    const loop = startMediaOverlayLayoutLoop2d({
      enabled: true,
      loop: 'onDemand',
      items: ids.map(id => ({ id })),
      density: 'default',
      viewportW: 960,
      viewportH: 540,
      schema: defaultSchema,
      collision: { enabled: true, gapPx: 12 },
      manualPlacement: true,
      readTransform: () => ({
        k: 1,
        x: 0,
        y: 0,
        applyX: (v: number) => v,
        applyY: (v: number) => v,
      }) as any,
      getElementForId: id => els.get(id) || null,
      getNodeWorldCenterForId: id => {
        if (!ids.includes(id)) return null
        return { x: 480, y: 270 }
      },
      getCollisionObstacles: () => {
        return collectCanonicalStoryboardWidgetOverlayRectEntries(queryActiveSurfaceOverlays('surface-a'))
          .map(entry => ({
            id: entry.id,
            left: entry.rect.left,
            top: entry.rect.top,
            width: entry.rect.width,
            height: entry.rect.height,
          }))
      },
      sizingConfig: { widthRatio: 0.18, widthMinPx: 180, widthMaxPx: 280 },
      clampToViewport: { margin: 12 },
    })

    loop.schedule()
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    const rects = ids.map(id => {
      const el = els.get(id)
      if (!el) throw new Error(`missing overlay element for ${id}`)
      const { left, top, width, height } = readVectorPaintedPanelBox(el)
      return { id, left, top, right: left + width, bottom: top + height }
    })

    const obstacleA = { left: 350, top: 170, right: 610, bottom: 350 }
    const obstacleB = { left: 40, top: 40, right: 360, bottom: 260 }

    const overlapsA = rects.some(rect => rect.left < obstacleA.right && obstacleA.left < rect.right && rect.top < obstacleA.bottom && obstacleA.top < rect.bottom)
    const overlapsB = rects.some(rect => rect.left < obstacleB.right && obstacleB.left < rect.right && rect.top < obstacleB.bottom && obstacleB.top < rect.bottom)

    if (overlapsA) {
      throw new Error('expected active-surface obstacle collection to affect final layout and avoid the surface-a widget obstacle')
    }
    if (!overlapsB) {
      throw new Error('expected non-active-surface obstacles to stay excluded from layout collision input')
    }

    loop.stop()
  } finally {
    restore()
  }
}
