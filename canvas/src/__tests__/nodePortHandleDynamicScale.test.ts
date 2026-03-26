import { computeDynamicNodePortHandlePx, computeZoomScaledPortHandlePx, shouldRenderNodePortHandleAsDot } from '@/components/GraphCanvas/portHandlesConfig'

export const testNodePortHandleDynamicScaleShrinksForSmallNodes = () => {
  const large = computeDynamicNodePortHandlePx({
    sizePx: 6,
    strokeWidthPx: 2,
    offsetPx: 4,
    nodeWidth: 320,
    nodeHeight: 180,
  })
  const small = computeDynamicNodePortHandlePx({
    sizePx: 6,
    strokeWidthPx: 2,
    offsetPx: 4,
    nodeWidth: 80,
    nodeHeight: 48,
  })
  if (!(small.sizePx < large.sizePx)) throw new Error('expected smaller nodes to use smaller port-handle radius')
  if (!(small.offsetPx < large.offsetPx)) throw new Error('expected smaller nodes to use smaller port-handle offset')
}

export const testNodePortHandleZoomScalingRespondsToZoom = () => {
  const base = computeDynamicNodePortHandlePx({
    sizePx: 6,
    strokeWidthPx: 2,
    offsetPx: 4,
    nodeWidth: 180,
    nodeHeight: 96,
  })
  const zoomedOut = computeZoomScaledPortHandlePx({ ...base, zoomK: 0.25 })
  const zoomedIn = computeZoomScaledPortHandlePx({ ...base, zoomK: 8 })
  if (!(zoomedOut.sizePx < base.sizePx)) throw new Error('expected zoomed-out port-handle to be smaller')
  if (!(zoomedIn.sizePx > base.sizePx)) throw new Error('expected zoomed-in port-handle to be larger')
  if (!shouldRenderNodePortHandleAsDot(zoomedOut.sizePx)) throw new Error('expected extreme zoom-out to render port-handle as dot')
}
