import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testSpatialCaptureRenderStageUsesBoundedGaussianSortCadence() {
  const source = [
    readFileSync(resolve(process.cwd(), 'src', 'features', 'three', 'SpatialCaptureManifestStage.tsx'), 'utf8'),
    readFileSync(resolve(process.cwd(), 'src', 'features', 'three', 'spatialCaptureGeometryRuntime.ts'), 'utf8'),
  ].join('\n')
  for (const marker of [
    'const SPATIAL_CAPTURE_SORT_DIRECTION_DOT_MIN = 0.985',
    'const SPATIAL_CAPTURE_SORT_INTERVAL_MS = 960',
    'const SPATIAL_CAPTURE_SORT_SETTLE_MS = 180',
    'const SPATIAL_CAPTURE_PROGRESSIVE_INTERVAL_MS = 160',
    'const SPATIAL_CAPTURE_PROGRESSIVE_MIN_STEP = 120_000',
    'const SPATIAL_CAPTURE_PROGRESSIVE_STEP_FACTOR = 1.45',
    'loadSpatialCapturePointCloudPreview(manifest)',
    'promoteLoad(previewLoad)',
    'previewLoad.pointCloud.pointCount >= previewLoad.pointCloud.sourcePointCount',
    'SPATIAL_CAPTURE_FULL_PROMOTION_DELAY_MS',
    'await waitForSpatialCapturePreviewFirstPaint()',
    'sliceSpatialCaptureFloatAttribute',
    'syncSpatialCaptureGeometryAttributeViews(geometry, load, boundedCount)',
    'syncGaussianSplatGeometryAttributeViews(geometry, load, initialCount)',
    'geometry.userData.kgSpatialCaptureAttributeCount',
    'const initialCount = resolveSpatialCaptureInitialInstanceCount(load)',
    'geometry.instanceCount = initialCount',
    'const gaussianSortScratchByGeometry = new WeakMap<THREE.InstancedBufferGeometry, GaussianSortScratch>()',
    'resolveGaussianSortScratch(geometry, count, bucketCount)',
    'histogram.fill(0)',
    'resolveWritableReorderAttribute',
    'advanceSpatialCaptureProgressiveCount(geometry, state.load)',
    'readSpatialCaptureGeometryCount(geometry, state.load) < state.load.pointCloud.pointCount',
    'sortState.pendingDirection = nextDirection',
    'elapsedMs - sortState.pendingSinceMs < SPATIAL_CAPTURE_SORT_SETTLE_MS',
    'gaussianSplatMaterial.uniforms.opacityScale.value = paused ? 0.42 : 1.0',
    'gaussianSplatMaterial.uniforms.viewportSize.value.set(Math.max(1, size.width), Math.max(1, size.height))',
    "state.load.pointCloud.kind !== 'gaussian-splat'\n      || paused\n      || !(geometry instanceof THREE.InstancedBufferGeometry)",
    'updateGaussianSplatGeometrySort(geometry, state.load, pendingDirection)',
  ]) {
    if (!source.includes(marker)) throw new Error(`expected bounded Gaussian sort cadence marker ${marker}`)
  }
  for (const staleMarker of [
    'buildInitialDepthSortedIndex',
    'geometry.instanceCount = load.pointCloud.pointCount',
    'readModelAssetCameraPose',
    "geometry.setAttribute('splatCenter', new THREE.InstancedBufferAttribute(load.pointCloud.positions, 3))",
  ]) {
    if (source.includes(staleMarker)) throw new Error(`unexpected stale initial sort marker ${staleMarker}`)
  }
}
