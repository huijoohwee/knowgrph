import { useGraphStore } from '@/hooks/useGraphStore'
import type { SettingMeta } from './types'
import { clampSnapGridSize, SNAP_GRID_SIZE_DEFAULT } from '@/lib/canvas/gridSnap'
import {
  CANVAS_GRID_DOT_RADIUS_PX_DEFAULT,
  clampCanvasGridDotRadiusPx,
  clampCanvasGridMajorEvery,
  coerceCanvasGridVariant,
} from '@/lib/canvas/canvasGridConfig'

const s = () => useGraphStore.getState()

const readSnapGrid = () => {
  const schema = s().schema
  const g = schema?.behavior?.snapGrid
  const enabled = !!(g && g.enabled)
  const size = clampSnapGridSize((g as { size?: unknown } | null)?.size)
  return { enabled, size }
}

export const uiCanvasGridSettingsRegistry: SettingMeta[] = [
  {
    key: 'canvasSnapEnabled',
    type: 'boolean',
    source: 'store',
    read: () => readSnapGrid().enabled,
    write: (v) => {
      const { size } = readSnapGrid()
      s().setBehavior({ snapGrid: { enabled: !!v, size } })
    },
    default: () => false,
  },
  {
    key: 'canvasSnapGridSize',
    type: 'number',
    source: 'store',
    read: () => readSnapGrid().size,
    write: (v) => {
      const { enabled } = readSnapGrid()
      const size = clampSnapGridSize(Number(v))
      s().setBehavior({ snapGrid: { enabled, size } })
    },
    default: () => SNAP_GRID_SIZE_DEFAULT,
  },
  {
    key: 'canvasGridVisible',
    type: 'boolean',
    source: 'store',
    read: () => !!s().schema?.behavior?.canvasGrid?.enabled,
    write: (v) => {
      const schema = s().schema
      const cur = schema?.behavior?.canvasGrid
      const variant = coerceCanvasGridVariant((cur as any)?.variant)
      const majorEvery = clampCanvasGridMajorEvery((cur as any)?.majorEvery)
      const dotRadiusPx = clampCanvasGridDotRadiusPx((cur as any)?.dotRadiusPx)
      s().setBehavior({ canvasGrid: { enabled: !!v, variant, majorEvery, dotRadiusPx } })
    },
    default: () => false,
  },
  {
    key: 'canvasGridVariant',
    type: 'string',
    source: 'store',
    read: () => {
      const raw = (s().schema?.behavior?.canvasGrid as any)?.variant
      return coerceCanvasGridVariant(raw)
    },
    write: (v) => {
      const schema = s().schema
      const cur = schema?.behavior?.canvasGrid
      const enabled = !!(cur && (cur as any).enabled)
      const majorEvery = clampCanvasGridMajorEvery((cur as any)?.majorEvery)
      const dotRadiusPx = clampCanvasGridDotRadiusPx((cur as any)?.dotRadiusPx)
      const variant = coerceCanvasGridVariant(v)
      s().setBehavior({ canvasGrid: { enabled, variant, majorEvery, dotRadiusPx } })
    },
    default: () => 'dots',
    options: ['dots', 'lines'],
  },
  {
    key: 'canvasGridMajorEvery',
    type: 'number',
    source: 'store',
    read: () => {
      const raw = (s().schema?.behavior?.canvasGrid as any)?.majorEvery
      return clampCanvasGridMajorEvery(raw)
    },
    write: (v) => {
      const schema = s().schema
      const cur = schema?.behavior?.canvasGrid
      const enabled = !!(cur && (cur as any).enabled)
      const variant = coerceCanvasGridVariant((cur as any)?.variant)
      const dotRadiusPx = clampCanvasGridDotRadiusPx((cur as any)?.dotRadiusPx)
      const majorEvery = clampCanvasGridMajorEvery(v)
      s().setBehavior({ canvasGrid: { enabled, variant, majorEvery, dotRadiusPx } })
    },
    default: () => 5,
  },
  {
    key: 'canvasGridDotRadiusPx',
    type: 'number',
    source: 'store',
    read: () => {
      const raw = (s().schema?.behavior?.canvasGrid as any)?.dotRadiusPx
      return clampCanvasGridDotRadiusPx(raw)
    },
    write: (v) => {
      const schema = s().schema
      const cur = schema?.behavior?.canvasGrid
      const enabled = !!(cur && (cur as any).enabled)
      const variant = coerceCanvasGridVariant((cur as any)?.variant)
      const majorEvery = clampCanvasGridMajorEvery((cur as any)?.majorEvery)
      const dotRadiusPx = clampCanvasGridDotRadiusPx(v)
      s().setBehavior({ canvasGrid: { enabled, variant, majorEvery, dotRadiusPx } })
    },
    default: () => CANVAS_GRID_DOT_RADIUS_PX_DEFAULT,
  },
]
