import { LS_KEYS } from '@/lib/config.ls.keys'
import { getLocalStorage, lsSetFloat, lsSetInt } from '@/lib/persistence'
import {
  FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_DEFAULT,
  FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MAX,
  FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MIN,
} from '@/lib/canvas/flow-zoom-tuning'
import {
  CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_DEFAULT,
  CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MAX,
  CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MIN,
} from '@/lib/canvas/zoom-input'

export type CanvasSliceStorageMigrationPlan = {
  shouldPersist: boolean
  flowWheelZoomSpeedMultiplier: number | null
  wheelZoomCtrlMetaBoostMultiplier: number | null
}

const parseStoredInt = (storage: Storage | null, key: string, fallback: number): number => {
  if (!storage) return fallback
  try {
    const raw = storage.getItem(key)
    if (raw == null) return fallback
    const value = parseInt(String(raw).trim(), 10)
    return Number.isFinite(value) ? value : fallback
  } catch {
    return fallback
  }
}

const parseStoredFloat = (storage: Storage | null, key: string): number | null => {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (raw == null) return null
    const value = parseFloat(String(raw).trim())
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

export const planCanvasSliceStorageMigrations = (
  storage: Storage | null = getLocalStorage(),
): CanvasSliceStorageMigrationPlan => {
  const flowZoomDefaultsVersion = parseStoredInt(storage, LS_KEYS.flowWheelZoomDefaultsVersion, 0)
  if (flowZoomDefaultsVersion >= 3) {
    return {
      shouldPersist: false,
      flowWheelZoomSpeedMultiplier: null,
      wheelZoomCtrlMetaBoostMultiplier: null,
    }
  }

  const parsedFlowSpeed = parseStoredFloat(storage, LS_KEYS.flowWheelZoomSpeedMultiplier)
  const migrateFlowSpeed = parsedFlowSpeed == null
    || Math.abs(parsedFlowSpeed - 0.25) < 1e-6
    || Math.abs(parsedFlowSpeed - 0.333) < 1e-6
    || Math.abs(parsedFlowSpeed - 0.6) < 1e-6

  const parsedCtrlMetaBoost = parseStoredFloat(storage, LS_KEYS.wheelZoomCtrlMetaBoostMultiplier)
  const migrateCtrlMetaBoost = parsedCtrlMetaBoost == null
    || Math.abs(parsedCtrlMetaBoost - 12) < 1e-6
    || Math.abs(parsedCtrlMetaBoost - 16) < 1e-6
    || Math.abs(parsedCtrlMetaBoost - 80) < 1e-6

  return {
    shouldPersist: true,
    flowWheelZoomSpeedMultiplier: migrateFlowSpeed ? FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_DEFAULT : null,
    wheelZoomCtrlMetaBoostMultiplier: migrateCtrlMetaBoost ? CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_DEFAULT : null,
  }
}

export const applyCanvasSliceStorageMigrations = (storage: Storage | null = getLocalStorage()): boolean => {
  const plan = planCanvasSliceStorageMigrations(storage)
  if (!plan.shouldPersist || !storage) return false

  if (plan.flowWheelZoomSpeedMultiplier != null) {
    lsSetFloat(LS_KEYS.flowWheelZoomSpeedMultiplier, plan.flowWheelZoomSpeedMultiplier, {
      min: FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MIN,
      max: FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MAX,
    })
  }
  if (plan.wheelZoomCtrlMetaBoostMultiplier != null) {
    lsSetFloat(LS_KEYS.wheelZoomCtrlMetaBoostMultiplier, plan.wheelZoomCtrlMetaBoostMultiplier, {
      min: CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MIN,
      max: CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MAX,
    })
  }
  lsSetInt(LS_KEYS.flowWheelZoomDefaultsVersion, 3)
  return true
}
