export type ThreePhysicsFrameBuffers = {
  positionX: Float32Array
  positionY: Float32Array
  positionZ: Float32Array
  velocityX: Float32Array
  velocityY: Float32Array
  velocityZ: Float32Array
  targetRadiusByIndex: Float32Array
}

export function prepareThreePhysicsFrameBuffers(args: {
  buffers: ThreePhysicsFrameBuffers
  nodeCount: number
  sphereRadius: number
}): boolean {
  const { buffers, nodeCount } = args
  const {
    positionX,
    positionY,
    positionZ,
    velocityX,
    velocityY,
    velocityZ,
    targetRadiusByIndex,
  } = buffers
  if (
    positionX.length < nodeCount || positionY.length < nodeCount || positionZ.length < nodeCount ||
    velocityX.length < nodeCount || velocityY.length < nodeCount || velocityZ.length < nodeCount ||
    targetRadiusByIndex.length < nodeCount
  ) return false

  const sphereRadius = Number.isFinite(args.sphereRadius) && args.sphereRadius > 0
    ? args.sphereRadius
    : 1
  for (let index = 0; index < nodeCount; index += 1) {
    if (!(Number.isFinite(positionX[index]) && Number.isFinite(positionY[index]) && Number.isFinite(positionZ[index]))) {
      const targetRadius = targetRadiusByIndex[index]
      positionX[index] = Number.isFinite(targetRadius) && targetRadius > 0 ? targetRadius : sphereRadius
      positionY[index] = 0
      positionZ[index] = 0
      velocityX[index] = 0
      velocityY[index] = 0
      velocityZ[index] = 0
      continue
    }
    if (!Number.isFinite(velocityX[index])) velocityX[index] = 0
    if (!Number.isFinite(velocityY[index])) velocityY[index] = 0
    if (!Number.isFinite(velocityZ[index])) velocityZ[index] = 0
  }
  return true
}
