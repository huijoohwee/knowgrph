import type { SpatialCapturePointCloudLoad } from '@/lib/assets/spatialCaptureAssetRuntime'
import {
  DEFAULT_GAUSSIAN_SPLAT_EDIT_SETTINGS,
  inspectGaussianSplatLoad,
  readGaussianSplatEditSettings,
  type GaussianSplatEditSettings,
  type GaussianSplatInspection,
} from './gaussianSplatEditorModel'

export type GaussianSplatEditorStatus = 'loading' | 'ready' | 'empty' | 'error'

export type GaussianSplatEditorRuntimeSnapshot = Readonly<{
  sceneKey: string
  loadKey: string
  status: GaussianSplatEditorStatus
  load: SpatialCapturePointCloudLoad | null
  inspection: GaussianSplatInspection | null
  settings: GaussianSplatEditSettings
  revision: number
}>

type RuntimeListener = () => void

const listeners = new Set<RuntimeListener>()
const settingsBySceneKey = new Map<string, GaussianSplatEditSettings>()

function sceneMapKey(sceneKey: string): string {
  return sceneKey || '__empty-xr-scene__'
}

function resolveLoadKey(sceneKey: string, load: SpatialCapturePointCloudLoad | null): string {
  if (!load) return `${sceneKey}|empty`
  const cloud = load.pointCloud
  return [
    sceneKey,
    load.source,
    load.fidelity,
    load.byteLength,
    cloud.kind,
    cloud.sourcePointCount,
    cloud.pointCount,
  ].join('|')
}

function freezeSnapshot(value: GaussianSplatEditorRuntimeSnapshot): GaussianSplatEditorRuntimeSnapshot {
  return Object.freeze({
    ...value,
    settings: Object.freeze({ ...value.settings }),
  })
}

let snapshot = freezeSnapshot({
  sceneKey: '',
  loadKey: '|empty',
  status: 'empty',
  load: null,
  inspection: null,
  settings: DEFAULT_GAUSSIAN_SPLAT_EDIT_SETTINGS,
  revision: 0,
})

function publish(next: Omit<GaussianSplatEditorRuntimeSnapshot, 'revision'>): GaussianSplatEditorRuntimeSnapshot {
  snapshot = freezeSnapshot({ ...next, revision: snapshot.revision + 1 })
  for (const listener of [...listeners]) listener()
  return snapshot
}

function normalizeStatus(
  value: GaussianSplatEditorStatus | undefined,
  load: SpatialCapturePointCloudLoad | null,
): GaussianSplatEditorStatus {
  if (value === 'loading' || value === 'error') return value
  if (value === 'ready' && load) return value
  return load ? 'ready' : 'empty'
}

function settingsEqual(a: GaussianSplatEditSettings, b: GaussianSplatEditSettings): boolean {
  return a.visualization === b.visualization
    && a.opacityFloor === b.opacityFloor
    && a.scaleCeilingRatio === b.scaleCeilingRatio
    && a.cropInset === b.cropInset
    && a.brightness === b.brightness
    && a.saturation === b.saturation
    && a.pointBudgetRatio === b.pointBudgetRatio
}

export function readGaussianSplatEditorRuntime(): GaussianSplatEditorRuntimeSnapshot {
  return snapshot
}

export function subscribeGaussianSplatEditorRuntime(listener: RuntimeListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function hydrateGaussianSplatEditorRuntime(args: {
  sceneKey: string
  load: SpatialCapturePointCloudLoad | null
  status?: GaussianSplatEditorStatus
}): GaussianSplatEditorRuntimeSnapshot {
  const sceneKey = String(args.sceneKey || '')
  const load = args.load || null
  const status = normalizeStatus(args.status, load)
  if (snapshot.sceneKey === sceneKey && snapshot.load === load && snapshot.status === status) return snapshot
  const sameScene = snapshot.sceneKey === sceneKey
  const settings = sameScene
    ? snapshot.settings
    : settingsBySceneKey.get(sceneMapKey(sceneKey)) || DEFAULT_GAUSSIAN_SPLAT_EDIT_SETTINGS
  settingsBySceneKey.set(sceneMapKey(sceneKey), settings)
  return publish({
    sceneKey,
    loadKey: resolveLoadKey(sceneKey, load),
    status,
    load,
    inspection: load ? inspectGaussianSplatLoad(load, settings) : null,
    settings,
  })
}

export function updateGaussianSplatEditorSettings(
  patch: Partial<GaussianSplatEditSettings>,
): GaussianSplatEditorRuntimeSnapshot {
  const settings = readGaussianSplatEditSettings({ ...snapshot.settings, ...patch })
  if (settingsEqual(snapshot.settings, settings)) return snapshot
  settingsBySceneKey.set(sceneMapKey(snapshot.sceneKey), settings)
  return publish({
    ...snapshot,
    settings,
    inspection: snapshot.load ? inspectGaussianSplatLoad(snapshot.load, settings) : null,
  })
}

export function resetGaussianSplatEditorSettings(): GaussianSplatEditorRuntimeSnapshot {
  const settings = readGaussianSplatEditSettings(DEFAULT_GAUSSIAN_SPLAT_EDIT_SETTINGS)
  if (settingsEqual(snapshot.settings, settings)) return snapshot
  settingsBySceneKey.set(sceneMapKey(snapshot.sceneKey), settings)
  return publish({
    ...snapshot,
    settings,
    inspection: snapshot.load ? inspectGaussianSplatLoad(snapshot.load, settings) : null,
  })
}

export function resetGaussianSplatEditorRuntimeForTests(): void {
  listeners.clear()
  settingsBySceneKey.clear()
  snapshot = freezeSnapshot({
    sceneKey: '',
    loadKey: '|empty',
    status: 'empty',
    load: null,
    inspection: null,
    settings: DEFAULT_GAUSSIAN_SPLAT_EDIT_SETTINGS,
    revision: 0,
  })
}
