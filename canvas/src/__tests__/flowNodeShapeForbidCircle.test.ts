import { coerceFlowNativeNodeShape } from '@/components/FlowCanvas/shape'

export function testFlowNativeNodeShapeForbidCircleCoercesToRect() {
  const shape = coerceFlowNativeNodeShape({ shape: 'circle', forbidCircle: true })
  if (shape !== 'rect') throw new Error('expected circle to be coerced to rect')
}

export function testFlowNativeNodeShapeForbidCircleLeavesNonCircleUnchanged() {
  const diamond = coerceFlowNativeNodeShape({ shape: 'diamond', forbidCircle: true })
  if (diamond !== 'diamond') throw new Error('expected non-circle shapes to be preserved')
}

