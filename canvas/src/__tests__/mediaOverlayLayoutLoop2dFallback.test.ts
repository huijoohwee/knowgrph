import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { startMediaOverlayLayoutLoop2d } from '@/lib/render/mediaOverlayLayoutLoop2d'

export async function testMediaOverlayLayoutLoop2dSkipsWhenNodePosMissing() {
  const { dom, restore } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const root = dom.window.document.getElementById('root')
    if (!root) throw new Error('expected root container')
    const el = dom.window.document.createElement('div')
    el.dataset.kgPanelBox = 'leftTop'
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
