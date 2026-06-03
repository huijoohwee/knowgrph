import { useGraphStore } from '@/hooks/useGraphStore'
import type { SettingMeta } from './types'
import { clampSnapGridSize, readSnapGridScalarSize, SNAP_GRID_SIZE_DEFAULT } from '@/lib/canvas/snapGridSize'
import {
  CANVAS_GRID_DOT_RADIUS_PX_DEFAULT,
  CANVAS_GRID_MAJOR_ALPHA_DEFAULT,
  CANVAS_GRID_MAJOR_WIDTH_PX_DEFAULT,
  CANVAS_GRID_MINOR_ALPHA_DEFAULT,
  CANVAS_GRID_MINOR_WIDTH_PX_DEFAULT,
  clampCanvasGridAlpha,
  clampCanvasGridDotRadiusPx,
  clampCanvasGridMajorEvery,
  clampCanvasGridWidthPx,
  coerceCanvasGridVariant,
  coerceCanvasGridStroke,
} from '@/lib/canvas/canvasGridConfig'

const s = () => useGraphStore.getState()

const readSnapGrid = () => {
  const schema = s().schema
  const g = schema?.behavior?.snapGrid
  const enabled = !!(g && g.enabled)
  const size = readSnapGridScalarSize((g as { size?: unknown } | null)?.size)
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
      const minorAlpha = clampCanvasGridAlpha((cur as any)?.minorAlpha, CANVAS_GRID_MINOR_ALPHA_DEFAULT)
      const majorAlpha = clampCanvasGridAlpha((cur as any)?.majorAlpha, CANVAS_GRID_MAJOR_ALPHA_DEFAULT)
      const minorWidthPx = clampCanvasGridWidthPx((cur as any)?.minorWidthPx, CANVAS_GRID_MINOR_WIDTH_PX_DEFAULT)
      const majorWidthPx = clampCanvasGridWidthPx((cur as any)?.majorWidthPx, CANVAS_GRID_MAJOR_WIDTH_PX_DEFAULT)
      const minorStroke = coerceCanvasGridStroke((cur as any)?.minorStroke) || undefined
      const majorStroke = coerceCanvasGridStroke((cur as any)?.majorStroke) || undefined
      s().setBehavior({ canvasGrid: { enabled: !!v, variant, majorEvery, dotRadiusPx, minorAlpha, majorAlpha, minorWidthPx, majorWidthPx, minorStroke, majorStroke } })
    },
    default: () => false,
  },
  {
    key: 'canvasGridMinorAlpha',
    type: 'number',
    source: 'store',
    read: () => {
      const cur = s().schema?.behavior?.canvasGrid as any
      return clampCanvasGridAlpha(cur?.minorAlpha, CANVAS_GRID_MINOR_ALPHA_DEFAULT)
    },
    write: (v) => {
      const schema = s().schema
      const cur = schema?.behavior?.canvasGrid as any
      const enabled = !!(cur && cur.enabled)
      const variant = coerceCanvasGridVariant(cur?.variant)
      const majorEvery = clampCanvasGridMajorEvery(cur?.majorEvery)
      const dotRadiusPx = clampCanvasGridDotRadiusPx(cur?.dotRadiusPx)
      const majorAlpha = clampCanvasGridAlpha(cur?.majorAlpha, CANVAS_GRID_MAJOR_ALPHA_DEFAULT)
      const minorWidthPx = clampCanvasGridWidthPx(cur?.minorWidthPx, CANVAS_GRID_MINOR_WIDTH_PX_DEFAULT)
      const majorWidthPx = clampCanvasGridWidthPx(cur?.majorWidthPx, CANVAS_GRID_MAJOR_WIDTH_PX_DEFAULT)
      const minorAlpha = clampCanvasGridAlpha(v, CANVAS_GRID_MINOR_ALPHA_DEFAULT)
      const minorStroke = coerceCanvasGridStroke(cur?.minorStroke) || undefined
      const majorStroke = coerceCanvasGridStroke(cur?.majorStroke) || undefined
      s().setBehavior({ canvasGrid: { enabled, variant, majorEvery, dotRadiusPx, minorAlpha, majorAlpha, minorWidthPx, majorWidthPx, minorStroke, majorStroke } })
    },
    default: () => CANVAS_GRID_MINOR_ALPHA_DEFAULT,
  },
  {
    key: 'canvasGridMajorAlpha',
    type: 'number',
    source: 'store',
    read: () => {
      const cur = s().schema?.behavior?.canvasGrid as any
      return clampCanvasGridAlpha(cur?.majorAlpha, CANVAS_GRID_MAJOR_ALPHA_DEFAULT)
    },
    write: (v) => {
      const schema = s().schema
      const cur = schema?.behavior?.canvasGrid as any
      const enabled = !!(cur && cur.enabled)
      const variant = coerceCanvasGridVariant(cur?.variant)
      const majorEvery = clampCanvasGridMajorEvery(cur?.majorEvery)
      const dotRadiusPx = clampCanvasGridDotRadiusPx(cur?.dotRadiusPx)
      const minorAlpha = clampCanvasGridAlpha(cur?.minorAlpha, CANVAS_GRID_MINOR_ALPHA_DEFAULT)
      const minorWidthPx = clampCanvasGridWidthPx(cur?.minorWidthPx, CANVAS_GRID_MINOR_WIDTH_PX_DEFAULT)
      const majorWidthPx = clampCanvasGridWidthPx(cur?.majorWidthPx, CANVAS_GRID_MAJOR_WIDTH_PX_DEFAULT)
      const majorAlpha = clampCanvasGridAlpha(v, CANVAS_GRID_MAJOR_ALPHA_DEFAULT)
      const minorStroke = coerceCanvasGridStroke(cur?.minorStroke) || undefined
      const majorStroke = coerceCanvasGridStroke(cur?.majorStroke) || undefined
      s().setBehavior({ canvasGrid: { enabled, variant, majorEvery, dotRadiusPx, minorAlpha, majorAlpha, minorWidthPx, majorWidthPx, minorStroke, majorStroke } })
    },
    default: () => CANVAS_GRID_MAJOR_ALPHA_DEFAULT,
  },
  {
    key: 'canvasGridMinorWidthPx',
    type: 'number',
    source: 'store',
    read: () => {
      const cur = s().schema?.behavior?.canvasGrid as any
      return clampCanvasGridWidthPx(cur?.minorWidthPx, CANVAS_GRID_MINOR_WIDTH_PX_DEFAULT)
    },
    write: (v) => {
      const schema = s().schema
      const cur = schema?.behavior?.canvasGrid as any
      const enabled = !!(cur && cur.enabled)
      const variant = coerceCanvasGridVariant(cur?.variant)
      const majorEvery = clampCanvasGridMajorEvery(cur?.majorEvery)
      const dotRadiusPx = clampCanvasGridDotRadiusPx(cur?.dotRadiusPx)
      const minorAlpha = clampCanvasGridAlpha(cur?.minorAlpha, CANVAS_GRID_MINOR_ALPHA_DEFAULT)
      const majorAlpha = clampCanvasGridAlpha(cur?.majorAlpha, CANVAS_GRID_MAJOR_ALPHA_DEFAULT)
      const minorWidthPx = clampCanvasGridWidthPx(v, CANVAS_GRID_MINOR_WIDTH_PX_DEFAULT)
      const majorWidthPx = clampCanvasGridWidthPx(cur?.majorWidthPx, CANVAS_GRID_MAJOR_WIDTH_PX_DEFAULT)
      const minorStroke = coerceCanvasGridStroke(cur?.minorStroke) || undefined
      const majorStroke = coerceCanvasGridStroke(cur?.majorStroke) || undefined
      s().setBehavior({ canvasGrid: { enabled, variant, majorEvery, dotRadiusPx, minorAlpha, majorAlpha, minorWidthPx, majorWidthPx, minorStroke, majorStroke } })
    },
    default: () => CANVAS_GRID_MINOR_WIDTH_PX_DEFAULT,
  },
  {
    key: 'canvasGridMajorWidthPx',
    type: 'number',
    source: 'store',
    read: () => {
      const cur = s().schema?.behavior?.canvasGrid as any
      return clampCanvasGridWidthPx(cur?.majorWidthPx, CANVAS_GRID_MAJOR_WIDTH_PX_DEFAULT)
    },
    write: (v) => {
      const schema = s().schema
      const cur = schema?.behavior?.canvasGrid as any
      const enabled = !!(cur && cur.enabled)
      const variant = coerceCanvasGridVariant(cur?.variant)
      const majorEvery = clampCanvasGridMajorEvery(cur?.majorEvery)
      const dotRadiusPx = clampCanvasGridDotRadiusPx(cur?.dotRadiusPx)
      const minorAlpha = clampCanvasGridAlpha(cur?.minorAlpha, CANVAS_GRID_MINOR_ALPHA_DEFAULT)
      const majorAlpha = clampCanvasGridAlpha(cur?.majorAlpha, CANVAS_GRID_MAJOR_ALPHA_DEFAULT)
      const minorWidthPx = clampCanvasGridWidthPx(cur?.minorWidthPx, CANVAS_GRID_MINOR_WIDTH_PX_DEFAULT)
      const majorWidthPx = clampCanvasGridWidthPx(v, CANVAS_GRID_MAJOR_WIDTH_PX_DEFAULT)
      const minorStroke = coerceCanvasGridStroke(cur?.minorStroke) || undefined
      const majorStroke = coerceCanvasGridStroke(cur?.majorStroke) || undefined
      s().setBehavior({ canvasGrid: { enabled, variant, majorEvery, dotRadiusPx, minorAlpha, majorAlpha, minorWidthPx, majorWidthPx, minorStroke, majorStroke } })
    },
    default: () => CANVAS_GRID_MAJOR_WIDTH_PX_DEFAULT,
  },
  {
    key: 'canvasGridMinorStroke',
    type: 'string',
    source: 'store',
    read: () => {
      const cur = s().schema?.behavior?.canvasGrid as any
      return (typeof cur?.minorStroke === 'string' ? cur.minorStroke : '').trim()
    },
    write: (v) => {
      const schema = s().schema
      const cur = schema?.behavior?.canvasGrid as any
      const enabled = !!(cur && cur.enabled)
      const variant = coerceCanvasGridVariant(cur?.variant)
      const majorEvery = clampCanvasGridMajorEvery(cur?.majorEvery)
      const dotRadiusPx = clampCanvasGridDotRadiusPx(cur?.dotRadiusPx)
      const minorAlpha = clampCanvasGridAlpha(cur?.minorAlpha, CANVAS_GRID_MINOR_ALPHA_DEFAULT)
      const majorAlpha = clampCanvasGridAlpha(cur?.majorAlpha, CANVAS_GRID_MAJOR_ALPHA_DEFAULT)
      const minorWidthPx = clampCanvasGridWidthPx(cur?.minorWidthPx, CANVAS_GRID_MINOR_WIDTH_PX_DEFAULT)
      const majorWidthPx = clampCanvasGridWidthPx(cur?.majorWidthPx, CANVAS_GRID_MAJOR_WIDTH_PX_DEFAULT)
      const minorStroke = coerceCanvasGridStroke(v) || undefined
      const majorStroke = coerceCanvasGridStroke(cur?.majorStroke) || undefined
      s().setBehavior({ canvasGrid: { enabled, variant, majorEvery, dotRadiusPx, minorAlpha, majorAlpha, minorWidthPx, majorWidthPx, minorStroke, majorStroke } })
    },
    default: () => '',
  },
  {
    key: 'canvasGridMajorStroke',
    type: 'string',
    source: 'store',
    read: () => {
      const cur = s().schema?.behavior?.canvasGrid as any
      return (typeof cur?.majorStroke === 'string' ? cur.majorStroke : '').trim()
    },
    write: (v) => {
      const schema = s().schema
      const cur = schema?.behavior?.canvasGrid as any
      const enabled = !!(cur && cur.enabled)
      const variant = coerceCanvasGridVariant(cur?.variant)
      const majorEvery = clampCanvasGridMajorEvery(cur?.majorEvery)
      const dotRadiusPx = clampCanvasGridDotRadiusPx(cur?.dotRadiusPx)
      const minorAlpha = clampCanvasGridAlpha(cur?.minorAlpha, CANVAS_GRID_MINOR_ALPHA_DEFAULT)
      const majorAlpha = clampCanvasGridAlpha(cur?.majorAlpha, CANVAS_GRID_MAJOR_ALPHA_DEFAULT)
      const minorWidthPx = clampCanvasGridWidthPx(cur?.minorWidthPx, CANVAS_GRID_MINOR_WIDTH_PX_DEFAULT)
      const majorWidthPx = clampCanvasGridWidthPx(cur?.majorWidthPx, CANVAS_GRID_MAJOR_WIDTH_PX_DEFAULT)
      const minorStroke = coerceCanvasGridStroke(cur?.minorStroke) || undefined
      const majorStroke = coerceCanvasGridStroke(v) || undefined
      s().setBehavior({ canvasGrid: { enabled, variant, majorEvery, dotRadiusPx, minorAlpha, majorAlpha, minorWidthPx, majorWidthPx, minorStroke, majorStroke } })
    },
    default: () => '',
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
      const minorAlpha = clampCanvasGridAlpha((cur as any)?.minorAlpha, CANVAS_GRID_MINOR_ALPHA_DEFAULT)
      const majorAlpha = clampCanvasGridAlpha((cur as any)?.majorAlpha, CANVAS_GRID_MAJOR_ALPHA_DEFAULT)
      const minorWidthPx = clampCanvasGridWidthPx((cur as any)?.minorWidthPx, CANVAS_GRID_MINOR_WIDTH_PX_DEFAULT)
      const majorWidthPx = clampCanvasGridWidthPx((cur as any)?.majorWidthPx, CANVAS_GRID_MAJOR_WIDTH_PX_DEFAULT)
      const minorStroke = coerceCanvasGridStroke((cur as any)?.minorStroke) || undefined
      const majorStroke = coerceCanvasGridStroke((cur as any)?.majorStroke) || undefined
      const variant = coerceCanvasGridVariant(v)
      s().setBehavior({ canvasGrid: { enabled, variant, majorEvery, dotRadiusPx, minorAlpha, majorAlpha, minorWidthPx, majorWidthPx, minorStroke, majorStroke } })
    },
    default: () => 'lines',
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
      const minorAlpha = clampCanvasGridAlpha((cur as any)?.minorAlpha, CANVAS_GRID_MINOR_ALPHA_DEFAULT)
      const majorAlpha = clampCanvasGridAlpha((cur as any)?.majorAlpha, CANVAS_GRID_MAJOR_ALPHA_DEFAULT)
      const minorWidthPx = clampCanvasGridWidthPx((cur as any)?.minorWidthPx, CANVAS_GRID_MINOR_WIDTH_PX_DEFAULT)
      const majorWidthPx = clampCanvasGridWidthPx((cur as any)?.majorWidthPx, CANVAS_GRID_MAJOR_WIDTH_PX_DEFAULT)
      const minorStroke = coerceCanvasGridStroke((cur as any)?.minorStroke) || undefined
      const majorStroke = coerceCanvasGridStroke((cur as any)?.majorStroke) || undefined
      const majorEvery = clampCanvasGridMajorEvery(v)
      s().setBehavior({ canvasGrid: { enabled, variant, majorEvery, dotRadiusPx, minorAlpha, majorAlpha, minorWidthPx, majorWidthPx, minorStroke, majorStroke } })
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
      const minorAlpha = clampCanvasGridAlpha((cur as any)?.minorAlpha, CANVAS_GRID_MINOR_ALPHA_DEFAULT)
      const majorAlpha = clampCanvasGridAlpha((cur as any)?.majorAlpha, CANVAS_GRID_MAJOR_ALPHA_DEFAULT)
      const minorWidthPx = clampCanvasGridWidthPx((cur as any)?.minorWidthPx, CANVAS_GRID_MINOR_WIDTH_PX_DEFAULT)
      const majorWidthPx = clampCanvasGridWidthPx((cur as any)?.majorWidthPx, CANVAS_GRID_MAJOR_WIDTH_PX_DEFAULT)
      const minorStroke = coerceCanvasGridStroke((cur as any)?.minorStroke) || undefined
      const majorStroke = coerceCanvasGridStroke((cur as any)?.majorStroke) || undefined
      const dotRadiusPx = clampCanvasGridDotRadiusPx(v)
      s().setBehavior({ canvasGrid: { enabled, variant, majorEvery, dotRadiusPx, minorAlpha, majorAlpha, minorWidthPx, majorWidthPx, minorStroke, majorStroke } })
    },
    default: () => CANVAS_GRID_DOT_RADIUS_PX_DEFAULT,
  },
]
