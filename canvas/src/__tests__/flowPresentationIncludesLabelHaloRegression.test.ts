import { readFlowPresentation } from '@/components/FlowCanvas/presentation'

export function testFlowPresentationIncludesLabelHalo() {
  const p = readFlowPresentation({ schema: null })
  const w = (p.labels as unknown as { haloWidthPx?: unknown }).haloWidthPx
  if (!(typeof w === 'number' && Number.isFinite(w) && w > 0)) {
    throw new Error('expected haloWidthPx to be a positive number')
  }
  if (w !== 3) {
    throw new Error('expected default haloWidthPx = 3 when schema is null')
  }
}

