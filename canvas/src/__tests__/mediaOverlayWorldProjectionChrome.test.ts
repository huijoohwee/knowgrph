import { startMediaOverlayLayoutLoop2d } from '@/lib/render/mediaOverlayLayoutLoop2d'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMediaOverlayWorldProjectionKeepsUnscaledCardChromeMetrics() {
  const { dom, restore } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    const root = dom.window.document.getElementById('root')
    if (!root) throw new Error('expected root container')
    const panel = dom.window.document.createElement('section')
    root.appendChild(panel)
    const zoom = 0.57
    const loop = startMediaOverlayLayoutLoop2d({
      enabled: true,
      loop: 'onDemand',
      items: [{ id: 'media-panel' }],
      density: 'default',
      viewportW: 1175,
      viewportH: 962,
      readTransform: () => ({
        k: zoom,
        x: 0,
        y: 0,
        applyX: (value: number) => value * zoom,
        applyY: (value: number) => value * zoom,
      }) as any,
      computeSizingZoomK: () => zoom,
      projectWithWorldTransformScale: true,
      getPanelSizeForId: () => ({ w: 360, h: 203 }),
      getElementForId: id => id === 'media-panel' ? panel : null,
      getNodeWorldCenterForId: () => ({ x: 500, y: 400 }),
      sizingConfig: { widthRatio: 0.2, widthMinPx: 210, widthMaxPx: 360 },
      clampToViewport: null,
    })

    loop.schedule()
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    const expectedVars = {
      '--kg-media-panel-header-h': '28px',
      '--kg-media-panel-padding': '8px',
      '--kg-media-panel-radius': '10px',
      '--kg-media-panel-title-size': '12px',
    }
    for (const [name, expected] of Object.entries(expectedVars)) {
      const actual = panel.style.getPropertyValue(name)
      if (actual !== expected) throw new Error(`expected world-projected Rich Media chrome ${name}=${expected}, got ${actual}`)
    }
    if (String((panel.style as CSSStyleDeclaration & { zoom?: string }).zoom || '') !== String(zoom)) {
      throw new Error(`expected world projection to own zoom exactly once, got ${String((panel.style as CSSStyleDeclaration & { zoom?: string }).zoom || '')}`)
    }
    loop.stop()
  } finally {
    restore()
  }
}
