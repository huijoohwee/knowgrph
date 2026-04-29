import { computeMediaOverlaySizing } from '@/lib/render/mediaOverlaySizing'

export const testMediaOverlaySizingQuantizesContentWidth = () => {
  const sizing = computeMediaOverlaySizing({
    density: 'default',
    viewportW: 1000,
    viewportH: 600,
    zoomK: 1,
    itemCount: 1,
    config: { widthRatio: 0.2, widthMinPx: 210, widthMaxPx: 360, quantizeStepPx: 16 },
  })
  if (sizing.contentW % 16 !== 0) throw new Error(`expected contentW multiple of 16, got ${sizing.contentW}`)
  if (sizing.key !== `default|${sizing.contentW}`) throw new Error(`unexpected key: ${sizing.key}`)
  if (!(sizing.panelW > sizing.contentW)) throw new Error(`expected panelW > contentW, got panelW=${sizing.panelW} contentW=${sizing.contentW}`)
  if (!(sizing.panelH > 0)) throw new Error(`expected panelH > 0, got ${sizing.panelH}`)
}

export const testMediaOverlaySizingRespectsWidthClamp = () => {
  const small = computeMediaOverlaySizing({
    density: 'default',
    viewportW: 200,
    viewportH: 600,
    zoomK: 1,
    itemCount: 1,
    config: { widthRatio: 0.2, widthMinPx: 210, widthMaxPx: 360 },
  })
  const large = computeMediaOverlaySizing({
    density: 'default',
    viewportW: 10000,
    viewportH: 600,
    zoomK: 1,
    itemCount: 1,
    config: { widthRatio: 0.2, widthMinPx: 210, widthMaxPx: 360 },
  })
  if (!(small.contentW > 0)) throw new Error('expected sizing for small viewport')
  if (!(large.contentW >= small.contentW)) throw new Error(`expected large viewport to not shrink: small=${small.contentW} large=${large.contentW}`)
}

export const testMediaOverlaySizingIncreasesWithZoom = () => {
  const a = computeMediaOverlaySizing({
    density: 'default',
    viewportW: 1200,
    viewportH: 700,
    zoomK: 1,
    itemCount: 1,
    config: { widthRatio: 0.25, widthMinPx: 210, widthMaxPx: 360 },
  })
  const b = computeMediaOverlaySizing({
    density: 'default',
    viewportW: 1200,
    viewportH: 700,
    zoomK: 2,
    itemCount: 1,
    config: { widthRatio: 0.25, widthMinPx: 210, widthMaxPx: 360 },
  })
  if (!(b.contentW >= a.contentW)) throw new Error(`expected zoomK=2 to not shrink contentW: a=${a.contentW} b=${b.contentW}`)
}
