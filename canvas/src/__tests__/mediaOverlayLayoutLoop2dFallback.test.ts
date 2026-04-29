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
