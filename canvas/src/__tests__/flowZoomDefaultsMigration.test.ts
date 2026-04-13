import { LS_KEYS } from '@/lib/config.ls.keys'
import { applyCanvasSliceStorageMigrations, createCanvasSlice } from '@/hooks/store/canvasSlice'
import type { GraphState } from '@/hooks/store/types'
import {
  FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_DEFAULT,
  FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MIN,
  FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MAX,
} from '@/lib/canvas/flow-zoom-tuning'
import {
  CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_DEFAULT,
  CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MIN,
  CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MAX,
} from '@/lib/canvas/zoom-input'
import { getLocalStorage, lsSetFloat, lsSetInt } from '@/lib/persistence'

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>()

  get length(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) ?? null) : null
  }

  key(index: number): string | null {
    if (!Number.isFinite(index) || index < 0) return null
    const keys = Array.from(this.map.keys())
    return keys[index] ?? null
  }

  removeItem(key: string): void {
    this.map.delete(String(key))
  }

  setItem(key: string, value: string): void {
    this.map.set(String(key), String(value))
  }
}

const ensureLocalStorage = (): Storage => {
  const g = globalThis as unknown as { window?: unknown }
  const w = (g.window ?? {}) as { localStorage?: Storage }
  if (!w.localStorage) w.localStorage = new MemoryStorage()
  g.window = w as unknown as Window
  return w.localStorage
}

const bootCanvasSlice = () =>
  createCanvasSlice(
    () => {},
    () => ({} as unknown as GraphState),
  )

export function testFlowZoomDefaultsMigrationUpgradesPriorDefaults() {
  const storage = ensureLocalStorage()
  storage.clear()
  storage.setItem(LS_KEYS.flowWheelZoomSpeedMultiplier, '0.25')
  storage.setItem(LS_KEYS.wheelZoomCtrlMetaBoostMultiplier, '12')

  const slice = bootCanvasSlice()

  if (!(Math.abs(slice.flowWheelZoomSpeedMultiplier - FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_DEFAULT) < 1e-6)) {
    throw new Error('expected in-memory flow wheel zoom speed default to migrate from 0.25')
  }
  if (!(Math.abs(slice.wheelZoomCtrlMetaBoostMultiplier - CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_DEFAULT) < 1e-6)) {
    throw new Error('expected in-memory ctrl/meta wheel zoom boost default to migrate from 12')
  }
  if (storage.getItem(LS_KEYS.flowWheelZoomDefaultsVersion) != null) {
    throw new Error('expected slice construction to avoid writing migration version at import time')
  }

  applyCanvasSliceStorageMigrations()

  const migratedSpeed = parseFloat(storage.getItem(LS_KEYS.flowWheelZoomSpeedMultiplier) || '')
  const migratedBoost = parseFloat(storage.getItem(LS_KEYS.wheelZoomCtrlMetaBoostMultiplier) || '')
  const migratedVersion = parseInt(storage.getItem(LS_KEYS.flowWheelZoomDefaultsVersion) || '', 10)

  if (!(Number.isFinite(migratedSpeed) && Math.abs(migratedSpeed - FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_DEFAULT) < 1e-6)) {
    throw new Error('expected flow wheel zoom speed default to migrate from 0.25')
  }
  if (!(Number.isFinite(migratedBoost) && Math.abs(migratedBoost - CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_DEFAULT) < 1e-6)) {
    throw new Error('expected ctrl/meta wheel zoom boost default to migrate from 12')
  }
  if (migratedVersion !== 3) {
    throw new Error('expected flow wheel zoom defaults version to be set to 3')
  }
}

export function testFlowZoomDefaultsMigrationDoesNotOverrideCustomValues() {
  const storage = ensureLocalStorage()
  storage.clear()
  storage.setItem(LS_KEYS.flowWheelZoomSpeedMultiplier, '0.9')
  storage.setItem(LS_KEYS.wheelZoomCtrlMetaBoostMultiplier, '22')

  const slice = bootCanvasSlice()

  if (!(Math.abs(slice.flowWheelZoomSpeedMultiplier - 0.9) < 1e-6)) {
    throw new Error('expected in-memory migration to not override custom flow wheel zoom speed')
  }
  if (!(Math.abs(slice.wheelZoomCtrlMetaBoostMultiplier - 22) < 1e-6)) {
    throw new Error('expected in-memory migration to not override custom ctrl/meta wheel zoom boost')
  }

  applyCanvasSliceStorageMigrations()

  const speed = parseFloat(storage.getItem(LS_KEYS.flowWheelZoomSpeedMultiplier) || '')
  const boost = parseFloat(storage.getItem(LS_KEYS.wheelZoomCtrlMetaBoostMultiplier) || '')
  if (!(Number.isFinite(speed) && Math.abs(speed - 0.9) < 1e-6)) {
    throw new Error('expected migration to not override custom flow wheel zoom speed')
  }
  if (!(Number.isFinite(boost) && Math.abs(boost - 22) < 1e-6)) {
    throw new Error('expected migration to not override custom ctrl/meta wheel zoom boost')
  }
}

export function testFlowZoomDefaultsMigrationNoopsWhenVersionAlreadySet() {
  const storage = ensureLocalStorage()
  storage.clear()

  lsSetFloat(LS_KEYS.flowWheelZoomSpeedMultiplier, 0.25, {
    min: FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MIN,
    max: FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MAX,
  })
  lsSetFloat(LS_KEYS.wheelZoomCtrlMetaBoostMultiplier, 12, {
    min: CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MIN,
    max: CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MAX,
  })
  lsSetInt(LS_KEYS.flowWheelZoomDefaultsVersion, 3)

  const slice = bootCanvasSlice()

  if (!(Math.abs(slice.flowWheelZoomSpeedMultiplier - 0.25) < 1e-6)) {
    throw new Error('expected version guard to preserve in-memory flow wheel zoom speed')
  }
  if (!(Math.abs(slice.wheelZoomCtrlMetaBoostMultiplier - 12) < 1e-6)) {
    throw new Error('expected version guard to preserve in-memory ctrl/meta wheel zoom boost')
  }

  applyCanvasSliceStorageMigrations()

  const speed = parseFloat(storage.getItem(LS_KEYS.flowWheelZoomSpeedMultiplier) || '')
  const boost = parseFloat(storage.getItem(LS_KEYS.wheelZoomCtrlMetaBoostMultiplier) || '')
  if (!(Number.isFinite(speed) && Math.abs(speed - 0.25) < 1e-6)) {
    throw new Error('expected version guard to prevent flow wheel zoom speed migration')
  }
  if (!(Number.isFinite(boost) && Math.abs(boost - 12) < 1e-6)) {
    throw new Error('expected version guard to prevent ctrl/meta wheel zoom boost migration')
  }
}

export function testFlowZoomDefaultsMigrationWorksWithoutExistingKeys() {
  const storage = ensureLocalStorage()
  storage.clear()

  const existing = getLocalStorage()
  if (!existing) {
    throw new Error('expected localStorage to be available in migration test')
  }
  const slice = bootCanvasSlice()

  if (!(Math.abs(slice.flowWheelZoomSpeedMultiplier - FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_DEFAULT) < 1e-6)) {
    throw new Error('expected missing-key boot to use default flow wheel zoom speed in memory')
  }
  if (!(Math.abs(slice.wheelZoomCtrlMetaBoostMultiplier - CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_DEFAULT) < 1e-6)) {
    throw new Error('expected missing-key boot to use default ctrl/meta boost in memory')
  }

  applyCanvasSliceStorageMigrations()

  const version = parseInt(storage.getItem(LS_KEYS.flowWheelZoomDefaultsVersion) || '', 10)
  if (version !== 3) {
    throw new Error('expected version to be set even when keys are missing')
  }
}
