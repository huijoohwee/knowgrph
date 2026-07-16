import type { SpatialCapturePointCloudLoad } from '@/lib/assets/spatialCaptureAssetRuntime'
import type { PlyPointCloud } from '@/lib/assets/plyPointCloud'

export type GaussianSplatVisualization = 'render' | 'centers' | 'rings'

export type GaussianSplatEditSettings = {
  visualization: GaussianSplatVisualization
  opacityFloor: number
  scaleCeilingRatio: number
  cropInset: number
  brightness: number
  saturation: number
  pointBudgetRatio: number
}

export const DEFAULT_GAUSSIAN_SPLAT_EDIT_SETTINGS: GaussianSplatEditSettings = Object.freeze({
  visualization: 'render',
  opacityFloor: 0,
  scaleCeilingRatio: 1,
  cropInset: 0,
  brightness: 1,
  saturation: 1,
  pointBudgetRatio: 1,
})

export type GaussianSplatInspection = Readonly<{
  kind: PlyPointCloud['kind']
  editable: boolean
  fidelity: SpatialCapturePointCloudLoad['fidelity']
  source: SpatialCapturePointCloudLoad['source']
  sourcePointCount: number
  loadedPointCount: number
  eligiblePointCount: number
  visiblePointCount: number
  byteLength: number
  attributeBytes: number
  estimatedGpuBytes: number
  maxOpacity: number
  meanOpacity: number
  maxScale: number
  meanScale: number
  scaleCeiling: number
  bounds: PlyPointCloud['bounds']
}>

export type GaussianSplatExportSource = SpatialCapturePointCloudLoad | Readonly<{
  sceneKey?: string
  load: SpatialCapturePointCloudLoad | null
  settings?: Partial<GaussianSplatEditSettings>
}>

export const GAUSSIAN_SPLAT_EDIT_MANIFEST_SCHEMA = 'gaussian-splat-edit/v1' as const

export type GaussianSplatEditManifest = Readonly<{
  schema: typeof GAUSSIAN_SPLAT_EDIT_MANIFEST_SCHEMA
  sceneKey: string
  source: {
    kind: PlyPointCloud['kind']
    fidelity: SpatialCapturePointCloudLoad['fidelity']
    transport: SpatialCapturePointCloudLoad['source']
    byteLength: number
    sourcePointCount: number
    loadedPointCount: number
  }
  edit: GaussianSplatEditSettings
  result: {
    format: 'ply'
    eligiblePointCount: number
    pointCount: number
    estimatedGpuBytes: number
  }
  bounds: PlyPointCloud['bounds']
  publication: {
    mode: 'local-file'
    hosted: false
    runtimeDependency: false
  }
}>

const GAUSSIAN_SPLAT_SH_C0 = 0.28209479177387814
const PLY_ROW_FLOATS = 14
const PLY_ROW_BYTES = PLY_ROW_FLOATS * Float32Array.BYTES_PER_ELEMENT

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(min, Math.min(max, numeric))
}

export function readGaussianSplatEditSettings(value: unknown): GaussianSplatEditSettings {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const visualization = record.visualization === 'centers' || record.visualization === 'rings'
    ? record.visualization
    : 'render'
  return {
    visualization,
    opacityFloor: clamp(record.opacityFloor, 0, 1, DEFAULT_GAUSSIAN_SPLAT_EDIT_SETTINGS.opacityFloor),
    scaleCeilingRatio: clamp(record.scaleCeilingRatio, 0.01, 1, DEFAULT_GAUSSIAN_SPLAT_EDIT_SETTINGS.scaleCeilingRatio),
    cropInset: clamp(record.cropInset, 0, 0.49, DEFAULT_GAUSSIAN_SPLAT_EDIT_SETTINGS.cropInset),
    brightness: clamp(record.brightness, 0.25, 2, DEFAULT_GAUSSIAN_SPLAT_EDIT_SETTINGS.brightness),
    saturation: clamp(record.saturation, 0, 2, DEFAULT_GAUSSIAN_SPLAT_EDIT_SETTINGS.saturation),
    pointBudgetRatio: clamp(record.pointBudgetRatio, 0.01, 1, DEFAULT_GAUSSIAN_SPLAT_EDIT_SETTINGS.pointBudgetRatio),
  }
}

function copyBounds(bounds: PlyPointCloud['bounds']): PlyPointCloud['bounds'] {
  return {
    min: [...bounds.min],
    max: [...bounds.max],
    center: [...bounds.center],
    maxExtent: bounds.maxExtent,
  }
}

function splatScaleAt(pointCloud: PlyPointCloud, index: number): number {
  const offset = index * 3
  const values = pointCloud.splatScales
  if (!values || offset + 2 >= values.length) return 0
  return Math.max(values[offset] || 0, values[offset + 1] || 0, values[offset + 2] || 0)
}

function opacityAt(pointCloud: PlyPointCloud, index: number): number {
  const value = pointCloud.opacities?.[index]
  return Number.isFinite(value) ? Math.max(0, Math.min(1, Number(value))) : 1
}

function readSplatStats(pointCloud: PlyPointCloud): {
  maxOpacity: number
  meanOpacity: number
  maxScale: number
  meanScale: number
} {
  const count = Math.max(0, pointCloud.pointCount)
  if (!count) return { maxOpacity: 0, meanOpacity: 0, maxScale: 0, meanScale: 0 }
  let maxOpacity = 0
  let opacityTotal = 0
  let maxScale = 0
  let scaleTotal = 0
  for (let index = 0; index < count; index += 1) {
    const opacity = opacityAt(pointCloud, index)
    const scale = splatScaleAt(pointCloud, index)
    maxOpacity = Math.max(maxOpacity, opacity)
    opacityTotal += opacity
    maxScale = Math.max(maxScale, scale)
    scaleTotal += scale
  }
  return {
    maxOpacity,
    meanOpacity: opacityTotal / count,
    maxScale,
    meanScale: scaleTotal / count,
  }
}

export function resolveGaussianSplatCropBounds(
  pointCloud: PlyPointCloud,
  settingsValue: unknown,
): { min: [number, number, number]; max: [number, number, number] } {
  const settings = readGaussianSplatEditSettings(settingsValue)
  const min = pointCloud.bounds.min
  const max = pointCloud.bounds.max
  return {
    min: [
      min[0] + (max[0] - min[0]) * settings.cropInset,
      min[1] + (max[1] - min[1]) * settings.cropInset,
      min[2] + (max[2] - min[2]) * settings.cropInset,
    ],
    max: [
      max[0] - (max[0] - min[0]) * settings.cropInset,
      max[1] - (max[1] - min[1]) * settings.cropInset,
      max[2] - (max[2] - min[2]) * settings.cropInset,
    ],
  }
}

export function resolveGaussianSplatScaleCeiling(pointCloud: PlyPointCloud, settingsValue: unknown): number {
  return readSplatStats(pointCloud).maxScale * readGaussianSplatEditSettings(settingsValue).scaleCeilingRatio
}

function resolveEligibleIndices(pointCloud: PlyPointCloud, settings: GaussianSplatEditSettings): number[] {
  const crop = resolveGaussianSplatCropBounds(pointCloud, settings)
  const scaleCeiling = resolveGaussianSplatScaleCeiling(pointCloud, settings)
  const eligible: number[] = []
  for (let index = 0; index < pointCloud.pointCount; index += 1) {
    const offset = index * 3
    const x = pointCloud.positions[offset]
    const y = pointCloud.positions[offset + 1]
    const z = pointCloud.positions[offset + 2]
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
    if (x < crop.min[0] || x > crop.max[0] || y < crop.min[1] || y > crop.max[1] || z < crop.min[2] || z > crop.max[2]) continue
    if (opacityAt(pointCloud, index) < settings.opacityFloor) continue
    if (pointCloud.kind === 'gaussian-splat' && scaleCeiling > 0 && splatScaleAt(pointCloud, index) > scaleCeiling) continue
    eligible.push(index)
  }
  return eligible
}

function sampleEligibleIndices(eligible: readonly number[], ratio: number): Uint32Array {
  if (!eligible.length) return new Uint32Array(0)
  const count = Math.min(eligible.length, Math.max(1, Math.floor(eligible.length * ratio)))
  if (count >= eligible.length) return Uint32Array.from(eligible)
  const out = new Uint32Array(count)
  if (count === 1) {
    out[0] = eligible[0]
    return out
  }
  for (let index = 0; index < count; index += 1) {
    out[index] = eligible[Math.round((index * (eligible.length - 1)) / (count - 1))]
  }
  return out
}

export function resolveGaussianSplatVisibleIndices(pointCloud: PlyPointCloud, settingsValue: unknown): Uint32Array {
  const settings = readGaussianSplatEditSettings(settingsValue)
  return sampleEligibleIndices(resolveEligibleIndices(pointCloud, settings), settings.pointBudgetRatio)
}

function attributeBytes(pointCloud: PlyPointCloud): number {
  return pointCloud.positions.byteLength
    + (pointCloud.colors?.byteLength || 0)
    + (pointCloud.opacities?.byteLength || 0)
    + (pointCloud.splatScales?.byteLength || 0)
    + (pointCloud.splatRotations?.byteLength || 0)
}

export function inspectGaussianSplatLoad(
  load: SpatialCapturePointCloudLoad,
  settingsValue: unknown = DEFAULT_GAUSSIAN_SPLAT_EDIT_SETTINGS,
): GaussianSplatInspection {
  const settings = readGaussianSplatEditSettings(settingsValue)
  const stats = readSplatStats(load.pointCloud)
  const eligible = resolveEligibleIndices(load.pointCloud, settings)
  const visible = sampleEligibleIndices(eligible, settings.pointBudgetRatio)
  const attributes = attributeBytes(load.pointCloud)
  const sortIndexBytes = load.pointCloud.pointCount * (load.pointCloud.pointCount > 65_535 ? 4 : 2)
  const visibilityBytes = load.pointCloud.pointCount * Float32Array.BYTES_PER_ELEMENT
  return Object.freeze({
    kind: load.pointCloud.kind,
    editable: load.pointCloud.kind === 'gaussian-splat',
    fidelity: load.fidelity,
    source: load.source,
    sourcePointCount: load.pointCloud.sourcePointCount,
    loadedPointCount: load.pointCloud.pointCount,
    eligiblePointCount: eligible.length,
    visiblePointCount: visible.length,
    byteLength: load.byteLength,
    attributeBytes: attributes,
    estimatedGpuBytes: attributes + sortIndexBytes + visibilityBytes,
    ...stats,
    scaleCeiling: stats.maxScale * settings.scaleCeilingRatio,
    bounds: copyBounds(load.pointCloud.bounds),
  })
}

function isPointCloudLoad(value: GaussianSplatExportSource): value is SpatialCapturePointCloudLoad {
  return !!value && 'pointCloud' in value && 'fidelity' in value
}

function resolveExportSource(
  source: GaussianSplatExportSource,
  settingsValue?: unknown,
): { sceneKey: string; load: SpatialCapturePointCloudLoad; settings: GaussianSplatEditSettings } {
  const load = isPointCloudLoad(source) ? source : source.load
  if (!load) throw new Error('A loaded Gaussian splat is required for local export')
  const sourceSettings = isPointCloudLoad(source) ? DEFAULT_GAUSSIAN_SPLAT_EDIT_SETTINGS : source.settings
  const settings = readGaussianSplatEditSettings({ ...readGaussianSplatEditSettings(sourceSettings), ...(settingsValue as object || {}) })
  return { sceneKey: isPointCloudLoad(source) ? '' : String(source.sceneKey || ''), load, settings }
}

function assertGaussianSplat(pointCloud: PlyPointCloud): asserts pointCloud is PlyPointCloud & {
  colors: Float32Array
  opacities: Float32Array
  splatScales: Float32Array
  splatRotations: Float32Array
} {
  if (
    pointCloud.kind !== 'gaussian-splat'
    || !pointCloud.colors
    || !pointCloud.opacities
    || !pointCloud.splatScales
    || !pointCloud.splatRotations
  ) throw new Error('Local optimized PLY export requires Gaussian color, opacity, scale, and rotation attributes')
}

function writeFloat(view: DataView, offset: number, value: number): number {
  view.setFloat32(offset, Number.isFinite(value) ? value : 0, true)
  return offset + Float32Array.BYTES_PER_ELEMENT
}

function inverseOpacity(value: number): number {
  if (value >= 1) return 100
  const bounded = Math.max(0.001, Math.min(0.999999, value))
  return Math.log(bounded / (1 - bounded))
}

function editedColor(pointCloud: PlyPointCloud & { colors: Float32Array }, index: number, settings: GaussianSplatEditSettings): [number, number, number] {
  const offset = index * 3
  const red = pointCloud.colors[offset]
  const green = pointCloud.colors[offset + 1]
  const blue = pointCloud.colors[offset + 2]
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
  return [red, green, blue].map(value => Math.max(0, Math.min(1,
    (luminance + (value - luminance) * settings.saturation) * settings.brightness,
  ))) as [number, number, number]
}

function writeGaussianPlyRow(view: DataView, offsetValue: number, pointCloud: PlyPointCloud & {
  colors: Float32Array
  opacities: Float32Array
  splatScales: Float32Array
  splatRotations: Float32Array
}, index: number, settings: GaussianSplatEditSettings): void {
  const p = index * 3
  const q = index * 4
  const color = editedColor(pointCloud, index, settings)
  let offset = offsetValue
  offset = writeFloat(view, offset, -pointCloud.positions[p])
  offset = writeFloat(view, offset, -pointCloud.positions[p + 1])
  offset = writeFloat(view, offset, pointCloud.positions[p + 2])
  offset = writeFloat(view, offset, (color[0] - 0.5) / GAUSSIAN_SPLAT_SH_C0)
  offset = writeFloat(view, offset, (color[1] - 0.5) / GAUSSIAN_SPLAT_SH_C0)
  offset = writeFloat(view, offset, (color[2] - 0.5) / GAUSSIAN_SPLAT_SH_C0)
  offset = writeFloat(view, offset, inverseOpacity(pointCloud.opacities[index]))
  offset = writeFloat(view, offset, Math.log(Math.max(0.000001, pointCloud.splatScales[p])))
  offset = writeFloat(view, offset, Math.log(Math.max(0.000001, pointCloud.splatScales[p + 1])))
  offset = writeFloat(view, offset, Math.log(Math.max(0.000001, pointCloud.splatScales[p + 2])))
  const length = Math.hypot(
    pointCloud.splatRotations[q],
    pointCloud.splatRotations[q + 1],
    pointCloud.splatRotations[q + 2],
    pointCloud.splatRotations[q + 3],
  ) || 1
  offset = writeFloat(view, offset, pointCloud.splatRotations[q + 2] / length)
  offset = writeFloat(view, offset, pointCloud.splatRotations[q + 1] / length)
  offset = writeFloat(view, offset, -pointCloud.splatRotations[q] / length)
  writeFloat(view, offset, -pointCloud.splatRotations[q + 3] / length)
}

export function serializeOptimizedGaussianPly(
  source: GaussianSplatExportSource,
  settingsValue?: unknown,
): Uint8Array {
  const { load, settings } = resolveExportSource(source, settingsValue)
  const pointCloud = load.pointCloud
  assertGaussianSplat(pointCloud)
  const indices = resolveGaussianSplatVisibleIndices(pointCloud, settings)
  if (!indices.length) throw new Error('No Gaussian splats match the current edit settings')
  const header = new TextEncoder().encode([
    'ply',
    'format binary_little_endian 1.0',
    'comment local Gaussian splat edit export',
    'comment no hosted runtime required',
    `element vertex ${indices.length}`,
    'property float x',
    'property float y',
    'property float z',
    'property float f_dc_0',
    'property float f_dc_1',
    'property float f_dc_2',
    'property float opacity',
    'property float scale_0',
    'property float scale_1',
    'property float scale_2',
    'property float rot_0',
    'property float rot_1',
    'property float rot_2',
    'property float rot_3',
    'end_header',
    '',
  ].join('\n'))
  const out = new Uint8Array(header.byteLength + indices.length * PLY_ROW_BYTES)
  out.set(header)
  const view = new DataView(out.buffer)
  for (let cursor = 0; cursor < indices.length; cursor += 1) {
    writeGaussianPlyRow(view, header.byteLength + cursor * PLY_ROW_BYTES, pointCloud, indices[cursor], settings)
  }
  return out
}

export function buildOptimizedGaussianPlyBlob(source: GaussianSplatExportSource, settingsValue?: unknown): Blob {
  const bytes = serializeOptimizedGaussianPly(source, settingsValue)
  const blobBytes = new Uint8Array(bytes.byteLength)
  blobBytes.set(bytes)
  return new Blob([blobBytes], { type: 'model/ply' })
}

export function buildGaussianSplatEditManifest(
  source: GaussianSplatExportSource,
  settingsValue?: unknown,
): GaussianSplatEditManifest {
  const { sceneKey, load, settings } = resolveExportSource(source, settingsValue)
  const inspection = inspectGaussianSplatLoad(load, settings)
  return Object.freeze({
    schema: GAUSSIAN_SPLAT_EDIT_MANIFEST_SCHEMA,
    sceneKey,
    source: {
      kind: inspection.kind,
      fidelity: inspection.fidelity,
      transport: inspection.source,
      byteLength: inspection.byteLength,
      sourcePointCount: inspection.sourcePointCount,
      loadedPointCount: inspection.loadedPointCount,
    },
    edit: settings,
    result: {
      format: 'ply' as const,
      eligiblePointCount: inspection.eligiblePointCount,
      pointCount: inspection.visiblePointCount,
      estimatedGpuBytes: inspection.loadedPointCount > 0
        ? Math.round(inspection.estimatedGpuBytes * (inspection.visiblePointCount / inspection.loadedPointCount))
        : 0,
    },
    bounds: inspection.bounds,
    publication: { mode: 'local-file' as const, hosted: false as const, runtimeDependency: false as const },
  })
}

export function buildGaussianSplatEditManifestBlob(source: GaussianSplatExportSource, settingsValue?: unknown): Blob {
  const manifest = buildGaussianSplatEditManifest(source, settingsValue)
  return new Blob([`${JSON.stringify(manifest, null, 2)}\n`], { type: 'application/json;charset=utf-8' })
}

function filenameStem(value: unknown): string {
  const source = typeof value === 'string'
    ? value
    : value && typeof value === 'object' && 'sceneKey' in value
      ? String((value as { sceneKey?: unknown }).sceneKey || '')
      : ''
  const basename = source.replace(/\\/g, '/').split(/[?#]/)[0].split('/').filter(Boolean).pop() || 'gaussian-scene'
  const stem = basename.replace(/\.(?:ply|md|json)$/i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  return stem || 'gaussian-scene'
}

export function optimizedGaussianPlyFilename(value?: unknown): string {
  return `${filenameStem(value)}.optimized.ply`
}

export function gaussianSplatEditManifestFilename(value?: unknown): string {
  return `${filenameStem(value)}.gaussian-edit.json`
}
