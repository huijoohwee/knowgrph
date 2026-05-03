import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readCameraPoseTargetCenter } from '@/lib/graph/graphCenteredSvg3d/utils'

export const testGraphCenteredSvg3dUtilsReuseSharedPlainObjectGuard = () => {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'graph', 'graphCenteredSvg3d', 'utils.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected graph-centered svg 3d utils to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('const pose = isPlainObject(cameraPose) ? (cameraPose as Record<string, unknown>) : null')) {
    throw new Error('expected camera pose reads to reuse the shared plain-object guard')
  }
  if (!text.includes('const target = isPlainObject(pose?.target) ? (pose.target as Record<string, unknown>) : null')) {
    throw new Error('expected camera pose target reads to reuse the shared plain-object guard')
  }
  if (text.includes("cameraPose && typeof cameraPose === 'object' && !Array.isArray(cameraPose)")) {
    throw new Error('expected graph-centered svg 3d utils to stop coercing camera pose objects inline')
  }
}

export const testGraphCenteredSvg3dUtilsReadCameraPoseTargetCenter = () => {
  const center = readCameraPoseTargetCenter({
    target: { x: 12, y: -4, z: 30 },
  })
  if (!center) throw new Error('expected camera pose target center to be read')
  if (center.x !== 12 || center.y !== -4 || center.z !== 30) {
    throw new Error(`expected camera pose target center values to be preserved, got ${JSON.stringify(center)}`)
  }
}
