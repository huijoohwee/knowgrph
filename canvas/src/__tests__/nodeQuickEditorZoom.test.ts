import { computeNodeQuickEditorScale, computeNodeQuickEditorScaledSize } from '@/components/FlowEditor/nodeQuickEditorZoom'

function approxEq(a: number, b: number, eps = 1e-6): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return Math.abs(a - b) <= eps
}

export async function testNodeQuickEditorScaledSizeTracksZoomK() {
  const extent = { minK: 0.1, maxK: 8 }

  const s1 = computeNodeQuickEditorScale(1, extent)
  const z1 = computeNodeQuickEditorScaledSize(s1)
  if (z1.width <= 0 || z1.height <= 0) throw new Error('expected positive size at k=1')

  const sMin = computeNodeQuickEditorScale(extent.minK, extent)
  const zMin = computeNodeQuickEditorScaledSize(sMin)
  if (!approxEq(zMin.width, 360 * 0.6) || !approxEq(zMin.height, 520 * 0.6)) {
    throw new Error(`expected min scale at minK, got ${zMin.width}x${zMin.height}`)
  }

  const sMax = computeNodeQuickEditorScale(extent.maxK, extent)
  const zMax = computeNodeQuickEditorScaledSize(sMax)
  if (!approxEq(zMax.width, 360 * 0.6) || !approxEq(zMax.height, 520 * 0.6)) {
    throw new Error(`expected min scale at maxK, got ${zMax.width}x${zMax.height}`)
  }

  const midK = extent.minK + (extent.maxK - extent.minK) * 0.5
  const sMid = computeNodeQuickEditorScale(midK, extent)
  const zMid = computeNodeQuickEditorScaledSize(sMid)
  if (!approxEq(zMid.width, 360) || !approxEq(zMid.height, 520)) {
    throw new Error(`expected base size at midK, got ${zMid.width}x${zMid.height}`)
  }

  if (!(sMid > sMin && sMid > sMax)) {
    throw new Error(`expected mid scale to exceed extremes; got min=${sMin} mid=${sMid} max=${sMax}`)
  }

  const sZoomInHuge = computeNodeQuickEditorScale(99, extent)
  if (sZoomInHuge < 0.6) {
    throw new Error(`expected scale clamped to >=0.6, got ${sZoomInHuge}`)
  }

  const sZoomOutHuge = computeNodeQuickEditorScale(0.01, extent)
  if (sZoomOutHuge > 2.25) {
    throw new Error(`expected scale clamped to <=2.25, got ${sZoomOutHuge}`)
  }
}
