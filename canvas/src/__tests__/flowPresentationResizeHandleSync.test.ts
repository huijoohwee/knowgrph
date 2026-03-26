import { readFlowPresentation } from '@/components/FlowCanvas/presentation'

export const testFlowPresentationGroupResizeHandleUsesPortHandleSize = () => {
  const schema = {
    behavior: {
      portHandles: {
        enabled: true,
        size: 9,
        strokeWidth: 2.2,
      },
    },
    layout: {
      groups: {
        enabled: true,
        resizeHandle: {
          dotRadiusPx: 6,
          hitRadiusPx: 14,
          strokeWidthPx: 1.25,
          minBoundsSizePx: 24,
        },
      },
    },
  } as any

  const p = readFlowPresentation({ schema }) as any
  const rh = p?.groups?.resizeHandle
  if (!rh) throw new Error('expected groups.resizeHandle')
  if (Math.abs(rh.dotRadiusPx - 3.15) > 1e-6) throw new Error('expected group resize handle dot radius to scale from port handle size')
  if (rh.strokeWidthPx !== 2.2) throw new Error('expected group resize handle stroke width to match port handle stroke width')
  if (!(rh.hitRadiusPx >= rh.dotRadiusPx + 1)) throw new Error('expected hit radius to be at least dotRadius+1')
}
