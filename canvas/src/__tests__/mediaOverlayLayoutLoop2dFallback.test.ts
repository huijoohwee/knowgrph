import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { startMediaOverlayLayoutLoop2d } from '@/lib/render/mediaOverlayLayoutLoop2d'
import { defaultSchema } from '@/lib/graph/schema'

export async function testMediaOverlayLayoutLoop2dFallsBackWhenNodePosMissing() {
  const { dom, restore } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const root = dom.window.document.getElementById('root')
    if (!root) throw new Error('expected root container')
    const el = dom.window.document.createElement('div')
    root.appendChild(el)

    const loop = startMediaOverlayLayoutLoop2d({
      enabled: true,
      loop: 'onDemand',
      items: [{ id: 'm1' }],
      density: 'default',
      viewportW: 800,
      viewportH: 600,
      readTransform: () => ({
        k: 1,
        x: 0,
        y: 0,
        applyX: (v: number) => v,
        applyY: (v: number) => v,
      }) as any,
      getElementForId: (id: string) => (id === 'm1' ? el : null),
      getNodeWorldCenterForId: () => null,
      sizingConfig: { widthRatio: 0.2, widthMinPx: 210, widthMaxPx: 360 },
      clampToViewport: { margin: 12 },
    })

    loop.schedule()
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    const left = Number.parseFloat(el.style.left || 'NaN')
    const top = Number.parseFloat(el.style.top || 'NaN')
    if (Number.isFinite(left) || Number.isFinite(top)) throw new Error('expected overlay to remain unpositioned when node center is missing')
    loop.stop()
  } finally {
    restore()
  }
}

export const testMediaOverlayLayoutLoop2dSkipsWhenNodePosMissing = testMediaOverlayLayoutLoop2dFallsBackWhenNodePosMissing

function readTranslatedPanelBox(el: HTMLElement): { left: number; top: number; width: number; height: number } {
  const match = /translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px,\s*0px\)/.exec(String(el.style.transform || ''))
  if (!match) throw new Error(`expected translate3d transform, got ${el.style.transform || '(empty)'}`)
  const left = Number.parseFloat(match[1] || 'NaN')
  const top = Number.parseFloat(match[2] || 'NaN')
  const width = Number.parseFloat(el.style.width || 'NaN')
  const height = Number.parseFloat(el.style.height || 'NaN')
  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`expected finite overlay box, got ${JSON.stringify({ left, top, width, height })}`)
  }
  return { left, top, width, height }
}

export async function testMediaOverlayLayoutLoop2dPreservesInfiniteCanvasOffscreenPositions() {
  const { dom, restore } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const root = dom.window.document.getElementById('root')
    if (!root) throw new Error('expected root container')
    const ids = ['m1', 'm2', 'm3']
    const els = new Map<string, HTMLDivElement>()
    for (const id of ids) {
      const el = dom.window.document.createElement('div')
      root.appendChild(el)
      els.set(id, el)
    }

    const loop = startMediaOverlayLayoutLoop2d({
      enabled: true,
      loop: 'onDemand',
      items: ids.map(id => ({ id })),
      density: 'default',
      viewportW: 800,
      viewportH: 600,
      schema: defaultSchema,
      collision: { enabled: true, gapPx: 12 },
      readTransform: () => ({
        k: 1,
        x: 0,
        y: 0,
        applyX: (v: number) => v,
        applyY: (v: number) => v,
      }) as any,
      getElementForId: (id: string) => els.get(id) || null,
      getNodeWorldCenterForId: (id: string) => ids.includes(id) ? { x: -640, y: -420 } : null,
      sizingConfig: { widthRatio: 0.2, widthMinPx: 210, widthMaxPx: 360 },
      clampToViewport: null,
    })

    loop.schedule()
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    const boxes = ids.map(id => readTranslatedPanelBox(els.get(id)!))
    if (!boxes.every(box => box.left < -120 && box.top < -80)) {
      throw new Error(`expected infinite-canvas Rich Media overlays to remain offscreen instead of bouncing to viewport bounds: ${JSON.stringify(boxes)}`)
    }
    loop.stop()
  } finally {
    restore()
  }
}

export function testRichMediaOverlayCallersUseInfiniteCanvasClampPolicy() {
  const d3HookPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useRichMediaOverlays2d.ts')
  const flowOverlayPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const loopPath = resolve(process.cwd(), 'src', 'lib', 'render', 'mediaOverlayLayoutLoop2d.ts')
  const d3HookText = readFileSync(d3HookPath, 'utf8')
  const flowOverlayText = readFileSync(flowOverlayPath, 'utf8')
  const loopText = readFileSync(loopPath, 'utf8')

  if (!d3HookText.includes('clampToViewport: null')) {
    throw new Error('expected D3/flowchart Rich Media overlays to opt out of viewport clamp and follow the shared infinite-canvas transform')
  }
  if (!flowOverlayText.includes("const richMediaInfiniteCanvasMode = canvas2dRenderer === 'flowEditor' || canvas2dRenderer === 'flowCanvas'")) {
    throw new Error('expected Flow Editor and Flow Canvas Rich Media overlays to share the same infinite-canvas clamp policy')
  }
  for (const snippet of [
    'manualPlacement: richMediaInfiniteCanvasMode',
    'collision: richMediaInfiniteCanvasMode',
    'clampToViewport: richMediaInfiniteCanvasMode',
  ]) {
    if (!flowOverlayText.includes(snippet)) {
      throw new Error(`expected Flow Rich Media overlays to route ${snippet} through the shared infinite-canvas gate`)
    }
  }
  if (!loopText.includes('if (!viewportClampEnabled) return pos')) {
    throw new Error('expected shared media overlay layout loop to skip viewport clamp when infinite-canvas callers pass clampToViewport=null')
  }
  if (!loopText.includes('const shouldReseedBalancedCluster = viewportClampEnabled && (hasVerticalCluster || hasHorizontalStrip)')) {
    throw new Error('expected shared media overlay layout loop to avoid viewport-centered balanced reseeds in infinite-canvas mode')
  }
}

export async function testMediaOverlayLayoutLoop2dAvoidsSingleVerticalCluster() {
  const { dom, restore } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const root = dom.window.document.getElementById('root')
    if (!root) throw new Error('expected root container')
    const ids = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']
    const els = new Map<string, HTMLDivElement>()
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i]!
      const el = dom.window.document.createElement('div')
      root.appendChild(el)
      els.set(id, el)
    }

    const centerX = 320
    const centerY = 240
    const loop = startMediaOverlayLayoutLoop2d({
      enabled: true,
      loop: 'onDemand',
      items: ids.map(id => ({ id })),
      density: 'default',
      viewportW: 960,
      viewportH: 540,
      schema: defaultSchema,
      collision: { enabled: true, gapPx: 12 },
      readTransform: () => ({
        k: 1,
        x: 0,
        y: 0,
        applyX: (v: number) => v,
        applyY: (v: number) => v,
      }) as any,
      getElementForId: (id: string) => els.get(id) || null,
      getNodeWorldCenterForId: (id: string) => {
        if (!ids.includes(id)) return null
        return { x: centerX, y: centerY }
      },
      sizingConfig: { widthRatio: 0.18, widthMinPx: 180, widthMaxPx: 280 },
      clampToViewport: { margin: 12 },
    })

    loop.schedule()
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    const leftValues: number[] = []
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i]!
      const el = els.get(id)
      if (!el) throw new Error('missing overlay element')
      const m = /translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px,\s*0px\)/.exec(String(el.style.transform || ''))
      if (!m) throw new Error(`expected translate3d transform for ${id}`)
      const left = Number.parseFloat(m[1] || 'NaN')
      if (!Number.isFinite(left)) throw new Error(`expected finite left for ${id}`)
      leftValues.push(Math.round(left))
    }
    const uniqueColumns = new Set(leftValues)
    if (uniqueColumns.size < 2) {
      throw new Error('expected collision layout to avoid a single vertical overlay column')
    }
    loop.stop()
  } finally {
    restore()
  }
}

export async function testMediaOverlayLayoutLoop2dKeepsDenseCollectiveCenteredWithin16x9Bounds() {
  const { dom, restore } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const root = dom.window.document.getElementById('root')
    if (!root) throw new Error('expected root container')
    const ids = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']
    const els = new Map<string, HTMLDivElement>()
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i]!
      const el = dom.window.document.createElement('div')
      root.appendChild(el)
      els.set(id, el)
    }

    const centerX = 320
    const centerY = 240
    const viewportW = 960
    const viewportH = 540
    const loop = startMediaOverlayLayoutLoop2d({
      enabled: true,
      loop: 'onDemand',
      items: ids.map(id => ({ id })),
      density: 'default',
      viewportW,
      viewportH,
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
      getElementForId: (id: string) => els.get(id) || null,
      getNodeWorldCenterForId: (id: string) => {
        if (!ids.includes(id)) return null
        return { x: centerX, y: centerY }
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
      const match = /translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px,\s*0px\)/.exec(String(el.style.transform || ''))
      if (!match) throw new Error(`expected translate3d transform for ${id}`)
      const left = Number.parseFloat(match[1] || 'NaN')
      const top = Number.parseFloat(match[2] || 'NaN')
      const width = Number.parseFloat(el.style.width || 'NaN')
      const height = Number.parseFloat(el.style.height || 'NaN')
      if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height)) {
        throw new Error(`expected finite overlay box for ${id}`)
      }
      return { id, left, top, right: left + width, bottom: top + height, width, height }
    })

    const centroid = rects.reduce(
      (acc, rect) => ({ x: acc.x + rect.left + rect.width / 2, y: acc.y + rect.top + rect.height / 2 }),
      { x: 0, y: 0 },
    )
    centroid.x /= rects.length
    centroid.y /= rects.length

    const minLeft = Math.min(...rects.map(rect => rect.left))
    const maxRight = Math.max(...rects.map(rect => rect.right))
    const minTop = Math.min(...rects.map(rect => rect.top))
    const maxBottom = Math.max(...rects.map(rect => rect.bottom))
    const uniqueRows = new Set(rects.map(rect => Math.round(rect.top)))
    const uniqueCols = new Set(rects.map(rect => Math.round(rect.left)))
    const usableCenterX = viewportW / 2
    const usableCenterY = viewportH / 2

    if (Math.abs(centroid.x - usableCenterX) > 8 || Math.abs(centroid.y - usableCenterY) > 8) {
      throw new Error(`expected dense rich-media centroid near ${usableCenterX},${usableCenterY}, got ${centroid.x},${centroid.y}`)
    }
    if (minLeft < 12 || maxRight > viewportW - 12 || minTop < 12 || maxBottom > viewportH - 12) {
      throw new Error(
        `expected dense rich-media collective within viewport bounds, got ${minLeft},${minTop} → ${maxRight},${maxBottom}`,
      )
    }
    if (!(minLeft < usableCenterX && maxRight > usableCenterX && minTop < usableCenterY && maxBottom > usableCenterY)) {
      throw new Error(
        `expected dense rich-media collective footprint to span viewport center ${usableCenterX},${usableCenterY}`,
      )
    }
    if (uniqueRows.size < 2 || uniqueCols.size < 2) {
      throw new Error(`expected dense rich-media collective to avoid strip collapse, got rows=${uniqueRows.size}, cols=${uniqueCols.size}`)
    }

    for (let i = 0; i < rects.length; i += 1) {
      const a = rects[i]!
      for (let j = i + 1; j < rects.length; j += 1) {
        const b = rects[j]!
        const overlapX = a.left < b.right && b.left < a.right
        const overlapY = a.top < b.bottom && b.top < a.bottom
        if (overlapX && overlapY) throw new Error(`expected no overlap between ${a.id} and ${b.id}`)
      }
    }

    loop.stop()
  } finally {
    restore()
  }
}

export async function testMediaOverlayLayoutLoop2dKeepsMixedCollectiveClearOfWidgetObstacles() {
  const { dom, restore } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const root = dom.window.document.getElementById('root')
    if (!root) throw new Error('expected root container')
    const ids = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']
    const els = new Map<string, HTMLDivElement>()
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i]!
      const el = dom.window.document.createElement('div')
      root.appendChild(el)
      els.set(id, el)
    }

    const viewportW = 960
    const viewportH = 540
    const widgetObstacles = [
      { id: 'widget-left', left: 120, top: 160, width: 180, height: 160 },
      { id: 'widget-right', left: 660, top: 160, width: 180, height: 160 },
    ]
    const loop = startMediaOverlayLayoutLoop2d({
      enabled: true,
      loop: 'onDemand',
      items: ids.map(id => ({ id })),
      density: 'default',
      viewportW,
      viewportH,
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
      getElementForId: (id: string) => els.get(id) || null,
      getNodeWorldCenterForId: (id: string) => {
        if (!ids.includes(id)) return null
        return { x: viewportW / 2, y: viewportH / 2 }
      },
      getCollisionObstacles: () => widgetObstacles,
      sizingConfig: { widthRatio: 0.18, widthMinPx: 180, widthMaxPx: 280 },
      clampToViewport: { margin: 12 },
    })

    loop.schedule()
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    const rects = ids.map(id => {
      const el = els.get(id)
      if (!el) throw new Error(`missing overlay element for ${id}`)
      const match = /translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px,\s*0px\)/.exec(String(el.style.transform || ''))
      if (!match) throw new Error(`expected translate3d transform for ${id}`)
      const left = Number.parseFloat(match[1] || 'NaN')
      const top = Number.parseFloat(match[2] || 'NaN')
      const width = Number.parseFloat(el.style.width || 'NaN')
      const height = Number.parseFloat(el.style.height || 'NaN')
      if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height)) {
        throw new Error(`expected finite overlay box for ${id}`)
      }
      return { id, left, top, right: left + width, bottom: top + height, width, height }
    })

    const centroid = rects.reduce(
      (acc, rect) => ({ x: acc.x + rect.left + rect.width / 2, y: acc.y + rect.top + rect.height / 2 }),
      { x: 0, y: 0 },
    )
    centroid.x /= rects.length
    centroid.y /= rects.length

    const uniqueRows = new Set(rects.map(rect => Math.round(rect.top)))
    const uniqueCols = new Set(rects.map(rect => Math.round(rect.left)))
    if (uniqueRows.size < 2 || uniqueCols.size < 2) {
      throw new Error(`expected mixed collective to avoid strip collapse, got rows=${uniqueRows.size}, cols=${uniqueCols.size}`)
    }
    if (Math.abs(centroid.x - viewportW / 2) > 18 || Math.abs(centroid.y - viewportH / 2) > 18) {
      throw new Error(`expected mixed collective centroid near ${viewportW / 2},${viewportH / 2}, got ${centroid.x},${centroid.y}`)
    }

    for (let i = 0; i < rects.length; i += 1) {
      const rect = rects[i]!
      for (let j = 0; j < widgetObstacles.length; j += 1) {
        const obstacle = widgetObstacles[j]!
        const overlapX = rect.left < obstacle.left + obstacle.width && obstacle.left < rect.right
        const overlapY = rect.top < obstacle.top + obstacle.height && obstacle.top < rect.bottom
        if (overlapX && overlapY) {
          throw new Error(`expected mixed collective overlay ${rect.id} to avoid widget obstacle ${obstacle.id}`)
        }
      }
    }

    loop.stop()
  } finally {
    restore()
  }
}
