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
      panelDisplay: 'flex',
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
    if (panel.style.display !== 'flex') {
      throw new Error(`expected explicit panel display ownership to preserve the flex frame, got ${panel.style.display}`)
    }
    loop.stop()
  } finally {
    restore()
  }
}

export async function testMediaOverlayWorldProjectionUsesSharedPaintScale() {
  const { dom, restore } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    const root = dom.window.document.getElementById('root')
    if (!root) throw new Error('expected root container')
    const panel = dom.window.document.createElement('section')
    root.appendChild(panel)
    const cameraScale = 0.334
    const sharedPaintScale = 0.58
    const tx = 10
    const ty = 20
    const worldCenter = { x: 500, y: 400 }
    const panelSize = { w: 360, h: 203 }
    const loop = startMediaOverlayLayoutLoop2d({
      enabled: true,
      loop: 'onDemand',
      items: [{ id: 'media-panel' }],
      density: 'default',
      viewportW: 1175,
      viewportH: 962,
      readTransform: () => ({
        k: cameraScale,
        x: tx,
        y: ty,
        applyX: (value: number) => value * cameraScale + tx,
        applyY: (value: number) => value * cameraScale + ty,
      }) as any,
      computeSizingZoomK: () => sharedPaintScale,
      panelDisplay: 'flex',
      projectWithWorldTransformScale: true,
      getPanelSizeForId: () => panelSize,
      getElementForId: id => id === 'media-panel' ? panel : null,
      getNodeWorldCenterForId: () => worldCenter,
      sizingConfig: { widthRatio: 0.2, widthMinPx: 210, widthMaxPx: 360 },
      clampToViewport: null,
    })

    loop.schedule()
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    const paintedScale = Number((panel.style as CSSStyleDeclaration & { zoom?: string }).zoom || 0)
    if (Math.abs(paintedScale - sharedPaintScale) > 1e-6) {
      throw new Error(`expected Rich Media to use the shared Card paint scale ${sharedPaintScale}, got ${paintedScale}`)
    }
    const paintedCenterX = Number.parseFloat(panel.style.left) * paintedScale + panelSize.w * paintedScale / 2
    const paintedCenterY = Number.parseFloat(panel.style.top) * paintedScale + panelSize.h * paintedScale / 2
    const expectedCenterX = worldCenter.x * cameraScale + tx
    const expectedCenterY = worldCenter.y * cameraScale + ty
    if (Math.abs(paintedCenterX - expectedCenterX) > 0.51 || Math.abs(paintedCenterY - expectedCenterY) > 0.51) {
      throw new Error(`expected shared paint scale to preserve the camera-projected center ${expectedCenterX},${expectedCenterY}, got ${paintedCenterX},${paintedCenterY}`)
    }
    loop.stop()
  } finally {
    restore()
  }
}
