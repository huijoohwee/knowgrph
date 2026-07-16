import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_GAUSSIAN_SPLAT_EDIT_SETTINGS,
  buildGaussianSplatEditManifest,
  buildGaussianSplatEditManifestBlob,
  buildOptimizedGaussianPlyBlob,
  gaussianSplatEditManifestFilename,
  inspectGaussianSplatLoad,
  optimizedGaussianPlyFilename,
  resolveGaussianSplatVisibleIndices,
  serializeOptimizedGaussianPly,
  type GaussianSplatEditSettings,
} from '@/features/three/gaussianSplatEditorModel'
import {
  hydrateGaussianSplatEditorRuntime,
  readGaussianSplatEditorRuntime,
  resetGaussianSplatEditorRuntimeForTests,
  resetGaussianSplatEditorSettings,
  subscribeGaussianSplatEditorRuntime,
  updateGaussianSplatEditorSettings,
} from '@/features/three/gaussianSplatEditorRuntime'
import {
  buildGaussianSplatGeometry,
  updateGaussianSplatEditorVisibility,
  updateGaussianSplatGeometrySort,
} from '@/features/three/spatialCaptureGeometryRuntime'
import type { SpatialCapturePointCloudLoad } from '@/lib/assets/spatialCaptureAssetRuntime'
import { parsePlyPointCloud } from '@/lib/assets/plyPointCloud'

function buildGaussianLoad(): SpatialCapturePointCloudLoad {
  const positions = new Float32Array([
    0, 0, 0,
    1, 1, 1,
    2, 2, 2,
    3, 3, 3,
    4, 4, 4,
  ])
  const colors = new Float32Array([
    0.1, 0.2, 0.3,
    0.2, 0.4, 0.8,
    0.3, 0.4, 0.5,
    0.4, 0.5, 0.6,
    0.7, 0.8, 0.9,
  ])
  const opacities = new Float32Array([0.9, 0.8, 0.2, 0.7, 1])
  const splatScales = new Float32Array([
    0.2, 0.1, 0.1,
    0.5, 0.4, 0.3,
    0.2, 0.2, 0.2,
    1, 0.7, 0.5,
    3, 2, 1,
  ])
  const splatRotations = new Float32Array([
    0, 0, 0, 1,
    0, 0, 0, 1,
    0, 0, 1, 0,
    0, 1, 0, 0,
    1, 0, 0, 0,
  ])
  return {
    fidelity: 'full',
    source: 'pending-local',
    byteLength: 500,
    pointBudget: 5,
    pointCloud: {
      kind: 'gaussian-splat',
      positions,
      colors,
      opacities,
      splatScales,
      splatRotations,
      sourcePointCount: 9,
      pointCount: 5,
      bounds: {
        min: [0, 0, 0],
        max: [4, 4, 4],
        center: [2, 2, 2],
        maxExtent: 4,
      },
    },
  }
}

function closeTo(actual: number, expected: number, tolerance = 1e-5): boolean {
  return Math.abs(actual - expected) <= tolerance
}

function editedColor(color: readonly [number, number, number], settings: GaussianSplatEditSettings): [number, number, number] {
  const luminance = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722
  return color.map(value => Math.max(0, Math.min(1,
    (luminance + (value - luminance) * settings.saturation) * settings.brightness,
  ))) as [number, number, number]
}

export async function testGaussianSplatEditorModelInspectsFiltersAndExports() {
  const load = buildGaussianLoad()
  const baseline = inspectGaussianSplatLoad(load)
  if (
    !baseline.editable
    || baseline.sourcePointCount !== 9
    || baseline.loadedPointCount !== 5
    || baseline.visiblePointCount !== 5
    || baseline.attributeBytes !== 280
    || baseline.estimatedGpuBytes !== 310
    || !closeTo(baseline.meanOpacity, 0.72)
    || !closeTo(baseline.maxScale, 3)
    || !closeTo(baseline.meanScale, 0.98)
  ) {
    throw new Error(`expected exact Gaussian inspection telemetry, got ${JSON.stringify(baseline)}`)
  }

  const settings: GaussianSplatEditSettings = {
    visualization: 'rings',
    opacityFloor: 0.5,
    scaleCeilingRatio: 0.5,
    cropInset: 0.2,
    brightness: 1.2,
    saturation: 0.5,
    pointBudgetRatio: 0.5,
  }
  const inspection = inspectGaussianSplatLoad(load, settings)
  const indices = resolveGaussianSplatVisibleIndices(load.pointCloud, settings)
  if (inspection.eligiblePointCount !== 2 || inspection.visiblePointCount !== 1 || indices.join('|') !== '1') {
    throw new Error(`expected crop/opacity/scale filtering before deterministic budget sampling, got ${JSON.stringify({ inspection, indices: Array.from(indices) })}`)
  }

  const first = serializeOptimizedGaussianPly(load, settings)
  const second = serializeOptimizedGaussianPly(load, settings)
  if (first.length !== second.length || first.some((value, index) => value !== second[index])) {
    throw new Error('expected byte-identical optimized PLY exports for equal data and edit settings')
  }
  const baselineRoundTrip = parsePlyPointCloud(serializeOptimizedGaussianPly(load), 10)
  if (
    baselineRoundTrip.pointCount !== 5
    || baselineRoundTrip.opacities?.[4] !== 1
    || !baselineRoundTrip.splatRotations
    || !load.pointCloud.splatRotations
    || baselineRoundTrip.splatRotations.some((value, index) => !closeTo(value, load.pointCloud.splatRotations![index]))
  ) {
    throw new Error('expected default optimized PLY export to preserve normalized opacity and projected rotations')
  }
  const roundTrip = parsePlyPointCloud(first, 10)
  const expectedColor = editedColor([0.2, 0.4, 0.8], settings)
  if (
    roundTrip.kind !== 'gaussian-splat'
    || roundTrip.pointCount !== 1
    || roundTrip.sourcePointCount !== 1
    || !closeTo(roundTrip.positions[0], 1)
    || !closeTo(roundTrip.positions[1], 1)
    || !closeTo(roundTrip.positions[2], 1)
    || !roundTrip.colors
    || !closeTo(roundTrip.colors[0], expectedColor[0])
    || !closeTo(roundTrip.colors[1], expectedColor[1])
    || !closeTo(roundTrip.colors[2], expectedColor[2])
    || !roundTrip.opacities
    || !closeTo(roundTrip.opacities[0], 0.8)
    || !roundTrip.splatScales
    || !closeTo(roundTrip.splatScales[0], 0.5)
    || !roundTrip.splatRotations
    || !closeTo(roundTrip.splatRotations[3], 1)
  ) {
    throw new Error(`expected optimized PLY inverse mappings and baked appearance to round-trip, got ${JSON.stringify({
      kind: roundTrip.kind,
      positions: Array.from(roundTrip.positions),
      colors: roundTrip.colors ? Array.from(roundTrip.colors) : null,
      opacities: roundTrip.opacities ? Array.from(roundTrip.opacities) : null,
      scales: roundTrip.splatScales ? Array.from(roundTrip.splatScales) : null,
      rotations: roundTrip.splatRotations ? Array.from(roundTrip.splatRotations) : null,
    })}`)
  }

  const exportSource = { sceneKey: '/shots/Scene Alpha.ply', load, settings }
  const manifest = buildGaussianSplatEditManifest(exportSource)
  const manifestBlob = buildGaussianSplatEditManifestBlob(exportSource)
  const plyBlob = buildOptimizedGaussianPlyBlob(exportSource)
  if (
    manifest.schema !== 'gaussian-splat-edit/v1'
    || manifest.sceneKey !== '/shots/Scene Alpha.ply'
    || manifest.result.eligiblePointCount !== 2
    || manifest.result.pointCount !== 1
    || manifest.publication.mode !== 'local-file'
    || manifest.publication.hosted
    || manifest.publication.runtimeDependency
    || plyBlob.type !== 'model/ply'
    || plyBlob.size !== first.byteLength
    || manifestBlob.type !== 'application/json;charset=utf-8'
    || !(await manifestBlob.text()).endsWith('\n')
    || optimizedGaussianPlyFilename(exportSource) !== 'scene-alpha.optimized.ply'
    || gaussianSplatEditManifestFilename(exportSource) !== 'scene-alpha.gaussian-edit.json'
  ) {
    throw new Error(`expected provider-neutral local publication artifacts, got ${JSON.stringify({ manifest, plyType: plyBlob.type, plySize: plyBlob.size })}`)
  }

  const modelSource = readFileSync(resolve(process.cwd(), 'src', 'features', 'three', 'gaussianSplatEditorModel.ts'), 'utf8').toLowerCase()
  for (const token of [`play${'canvas'}`, `super${'splat'}`]) {
    if (modelSource.includes(token)) throw new Error(`expected clean-room model source to omit external implementation marker ${token}`)
  }
}

export function testGaussianSplatEditorRuntimePreservesSceneDrafts() {
  resetGaussianSplatEditorRuntimeForTests()
  const load = buildGaussianLoad()
  let notifications = 0
  const unsubscribe = subscribeGaussianSplatEditorRuntime(() => { notifications += 1 })
  try {
    hydrateGaussianSplatEditorRuntime({ sceneKey: 'scene-a', load: null, status: 'loading' })
    let runtime = readGaussianSplatEditorRuntime()
    if (runtime.status !== 'loading' || runtime.load || runtime.inspection) {
      throw new Error(`expected explicit loading state before asset resolution, got ${JSON.stringify(runtime)}`)
    }
    hydrateGaussianSplatEditorRuntime({ sceneKey: 'scene-a', load })
    updateGaussianSplatEditorSettings({
      visualization: 'centers',
      opacityFloor: 0.6,
      pointBudgetRatio: 0.5,
    })
    runtime = readGaussianSplatEditorRuntime()
    if (
      runtime.status !== 'ready'
      || runtime.load !== load
      || runtime.settings.visualization !== 'centers'
      || runtime.inspection?.visiblePointCount !== 2
    ) {
      throw new Error(`expected ready runtime to publish edited inspection, got ${JSON.stringify(runtime)}`)
    }
    const sceneASettings = runtime.settings
    hydrateGaussianSplatEditorRuntime({ sceneKey: 'scene-b', load: null })
    const sceneBSettings = readGaussianSplatEditorRuntime().settings
    if (JSON.stringify(sceneBSettings) !== JSON.stringify(DEFAULT_GAUSSIAN_SPLAT_EDIT_SETTINGS)) {
      throw new Error('expected a new scene identity to start from default Gaussian edit settings')
    }
    updateGaussianSplatEditorSettings({ brightness: 2 })
    hydrateGaussianSplatEditorRuntime({ sceneKey: 'scene-a', load })
    runtime = readGaussianSplatEditorRuntime()
    if (runtime.settings.visualization !== sceneASettings.visualization || runtime.settings.opacityFloor !== sceneASettings.opacityFloor) {
      throw new Error(`expected per-scene edit settings to survive scene switches, got ${JSON.stringify(runtime.settings)}`)
    }
    const beforeNoop = notifications
    const stable = hydrateGaussianSplatEditorRuntime({ sceneKey: 'scene-a', load })
    if (stable !== runtime || notifications !== beforeNoop) {
      throw new Error('expected repeated hydration of the same scene/load identity to be a no-op')
    }
    resetGaussianSplatEditorSettings()
    runtime = readGaussianSplatEditorRuntime()
    if (runtime.settings.visualization !== 'render' || runtime.settings.opacityFloor !== 0 || runtime.inspection?.visiblePointCount !== 5) {
      throw new Error(`expected reset to restore default edit semantics and inspection, got ${JSON.stringify(runtime)}`)
    }
    if (notifications < 5 || runtime.revision !== notifications) {
      throw new Error(`expected one revision and listener notification per published transition, got ${JSON.stringify({ notifications, revision: runtime.revision })}`)
    }
  } finally {
    unsubscribe()
    resetGaussianSplatEditorRuntimeForTests()
  }
}

export function testGaussianSplatEditorVisibilityPreservesSourceOrderAfterDegenerateSort() {
  const load = buildGaussianLoad()
  const geometry = buildGaussianSplatGeometry(load)
  try {
    updateGaussianSplatGeometrySort(geometry, load, [1, 0, 0])
    updateGaussianSplatGeometrySort(geometry, load, [1, -1, 0])
    const visibility = new Float32Array([0, 1, 0, 1, 0])
    updateGaussianSplatEditorVisibility(geometry, visibility)
    const actual = Array.from(geometry.getAttribute('splatEditorVisible').array)
    if (actual.join('|') !== Array.from(visibility).join('|')) {
      throw new Error(`expected an equal-depth sort to retain source-order visibility, got ${actual.join('|')}`)
    }
  } finally {
    geometry.dispose()
  }
}
