import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { GraphNode } from '@/lib/graph/types'
import {
  buildCurvedEdgeTubeGeometry,
  createCurvedEdgeGeometryScratch,
} from '@/features/three/curvedEdgeGeometry'
import { prepareThreePhysicsFrameBuffers } from '@/features/three/threePhysicsBuffers'
import { asVec3, computePositions3d } from '@/lib/three/positions.impl'

const readCanvasSource = (...parts: string[]): string =>
  readFileSync(resolve(process.cwd(), 'src', ...parts), 'utf8')

export function testThreeCurvedEdgeGeometryRejectsNonFiniteInputs() {
  const scratch = createCurvedEdgeGeometryScratch()
  const valid = buildCurvedEdgeTubeGeometry({
    start: [0, 0, 0],
    end: [40, 20, 5],
    curvature: 0.3,
    resolution: 24,
    rotation: 0,
    width: 1.5,
    scratch,
  })
  if (!valid) throw new Error('expected finite curved-edge inputs to build a tube')
  const positions = valid.getAttribute('position')
  for (let index = 0; index < positions.count; index += 1) {
    if (![positions.getX(index), positions.getY(index), positions.getZ(index)].every(Number.isFinite)) {
      valid.dispose()
      throw new Error('expected curved-edge tube positions to remain finite')
    }
  }
  valid.dispose()

  const invalidEndpoint = buildCurvedEdgeTubeGeometry({
    start: [0, 0, 0],
    end: [Number.NaN, 20, 5],
    curvature: 0.3,
    resolution: 24,
    rotation: 0,
    width: 1.5,
    scratch,
  })
  if (invalidEndpoint) {
    invalidEndpoint.dispose()
    throw new Error('expected a non-finite endpoint to fail closed before TubeGeometry construction')
  }

  const invalidWidth = buildCurvedEdgeTubeGeometry({
    start: [0, 0, 0],
    end: [40, 20, 5],
    curvature: 0.3,
    resolution: 24,
    rotation: 0,
    width: Number.POSITIVE_INFINITY,
    scratch,
  })
  if (invalidWidth) {
    invalidWidth.dispose()
    throw new Error('expected a non-finite width to fail closed before TubeGeometry construction')
  }
  const invalidRotation = buildCurvedEdgeTubeGeometry({
    start: [0, 0, 0],
    end: [40, 20, 5],
    curvature: 0.3,
    resolution: 24,
    rotation: Number.NaN,
    width: 1.5,
    scratch,
  })
  if (invalidRotation) {
    invalidRotation.dispose()
    throw new Error('expected non-finite curve parameters to fail closed before TubeGeometry construction')
  }
}

export function testThreePositionIngressRejectsNonFiniteVectors() {
  if (asVec3([0, Number.NaN, 1]) !== null || asVec3([0, 1, Number.POSITIVE_INFINITY]) !== null) {
    throw new Error('expected non-finite pos3d vectors to be rejected at shared ingress')
  }
  const nodes: GraphNode[] = [{
    id: 'finite-fallback',
    label: 'Finite fallback',
    type: 'Entity',
    properties: { pos3d: [Number.NaN, 1, 2] },
  }]
  const position = computePositions3d(nodes, null)['finite-fallback']
  if (!position || !position.every(Number.isFinite)) {
    throw new Error('expected rejected pos3d data to fall back to finite computed coordinates')
  }
}

export function testThreePhysicsBuffersInitializeBeforeFrameAndDisposeCurvedGeometry() {
  const shortBuffers = {
    positionX: new Float32Array(1), positionY: new Float32Array(1), positionZ: new Float32Array(1),
    velocityX: new Float32Array(1), velocityY: new Float32Array(1), velocityZ: new Float32Array(1),
    targetRadiusByIndex: new Float32Array([120]),
  }
  if (prepareThreePhysicsFrameBuffers({ buffers: shortBuffers, nodeCount: 2, sphereRadius: 120 })) {
    throw new Error('expected undersized first-frame physics buffers to fail closed')
  }
  const recoverableBuffers = {
    positionX: new Float32Array([0, Number.NaN]), positionY: new Float32Array([0, 2]), positionZ: new Float32Array([0, 3]),
    velocityX: new Float32Array([0, Number.NaN]), velocityY: new Float32Array(2), velocityZ: new Float32Array(2),
    targetRadiusByIndex: new Float32Array([100, 140]),
  }
  if (!prepareThreePhysicsFrameBuffers({ buffers: recoverableBuffers, nodeCount: 2, sphereRadius: 120 })) {
    throw new Error('expected correctly sized physics buffers to be frame-ready')
  }
  if (recoverableBuffers.positionX[1] !== 140 || recoverableBuffers.positionY[1] !== 0 || recoverableBuffers.positionZ[1] !== 0) {
    throw new Error('expected non-finite physics positions to recover on their finite target radius')
  }

  const layoutText = readCanvasSource('features', 'three', 'layout.ts')
  const initIndex = layoutText.indexOf('React.useLayoutEffect(() => {')
  const frameIndex = layoutText.indexOf('useFrame((_, delta) => {')
  if (initIndex < 0 || frameIndex < 0 || initIndex > frameIndex) {
    throw new Error('expected Physics3D buffers to initialize in a layout effect before the frame callback')
  }
  if (!layoutText.includes('if (!prepareThreePhysicsFrameBuffers({')) {
    throw new Error('expected Physics3D to enforce the shared pre-frame finite-buffer invariant')
  }

  const visualsText = readCanvasSource('features', 'three', 'visuals.tsx')
  if (!visualsText.includes('if (!tube) {') || !visualsText.includes('ref.current.visible = false')) {
    throw new Error('expected invalid curved-edge geometry to hide instead of rendering stale or non-finite data')
  }
  if (!visualsText.includes('geomRef.current?.dispose()') || !visualsText.includes('geomRef.current = null')) {
    throw new Error('expected the final curved-edge geometry to be disposed on unmount')
  }
}
