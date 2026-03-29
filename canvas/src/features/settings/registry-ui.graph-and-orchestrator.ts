import { useGraphStore } from '@/hooks/useGraphStore'
import { lsInt, lsSetInt } from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'
import {
  ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS,
} from '@/features/panels/utils/orchestratorTraversal'
import {
  FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_DEFAULT,
  FLOW_WHEEL_ZOOM_SMOOTH_MAX_DURATION_DEFAULT_MS,
  FLOW_WHEEL_ZOOM_SMOOTH_MIN_DURATION_DEFAULT_MS,
  FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_DEFAULT,
} from '@/lib/canvas/flow-zoom-tuning'
import { CANVAS_INTERACTION_SPEED_MULTIPLIER_DEFAULT, CANVAS_PAN_SPEED_MULTIPLIER_DEFAULT } from '@/lib/canvas/camera-options-2d'
import { CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_DEFAULT } from '@/lib/canvas/zoom-input'
import { DEFAULT_FIT_TO_SCREEN_FILL_RATIO, DEFAULT_ZOOM_MAX_SCALE, DEFAULT_ZOOM_MIN_SCALE } from '@/lib/graph/layoutDefaults'
import { DEFAULT_PHYSICS2D_TUNING } from '@/lib/graph/physics2dTuning'
import type { GraphSchema } from '@/lib/graph/schema'
import type { SettingMeta } from './types'

const s = () => useGraphStore.getState()

export const uiGraphAndOrchestratorSettingsRegistry: SettingMeta[] = [
  {
    key: 'viewport.fitFillRatio',
    type: 'number',
    source: 'store',
    read: () => s().viewportFitFillRatio,
    write: (v) => s().setViewportFitFillRatio(Number(v)),
    docKey: 'viewport.fitFillRatio',
    default: () => DEFAULT_FIT_TO_SCREEN_FILL_RATIO,
  },
  {
    key: 'schema.layout.forces.physics2dChargeScale',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { physics2dChargeScale?: unknown }).physics2dChargeScale
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_PHYSICS2D_TUNING.chargeScale
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0.1, Math.min(2, next)) : DEFAULT_PHYSICS2D_TUNING.chargeScale
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, physics2dChargeScale: clamped } } })
    },
    docKey: 'schema.layout.forces.physics2dChargeScale',
    default: () => DEFAULT_PHYSICS2D_TUNING.chargeScale,
  },
  {
    key: 'schema.layout.forces.physics2dCollideStrengthScale',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { physics2dCollideStrengthScale?: unknown }).physics2dCollideStrengthScale
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_PHYSICS2D_TUNING.collideStrengthScale
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0.1, Math.min(2, next)) : DEFAULT_PHYSICS2D_TUNING.collideStrengthScale
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, physics2dCollideStrengthScale: clamped } } })
    },
    docKey: 'schema.layout.forces.physics2dCollideStrengthScale',
    default: () => DEFAULT_PHYSICS2D_TUNING.collideStrengthScale,
  },
  {
    key: 'schema.layout.forces.physics2dBboxStrengthScale',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { physics2dBboxStrengthScale?: unknown }).physics2dBboxStrengthScale
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_PHYSICS2D_TUNING.bboxStrengthScale
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0.1, Math.min(2, next)) : DEFAULT_PHYSICS2D_TUNING.bboxStrengthScale
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, physics2dBboxStrengthScale: clamped } } })
    },
    docKey: 'schema.layout.forces.physics2dBboxStrengthScale',
    default: () => DEFAULT_PHYSICS2D_TUNING.bboxStrengthScale,
  },
  {
    key: 'schema.layout.forces.physics2dVelocityDecayBias',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { physics2dVelocityDecayBias?: unknown }).physics2dVelocityDecayBias
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_PHYSICS2D_TUNING.velocityDecayBias
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(-0.25, Math.min(0.25, next)) : DEFAULT_PHYSICS2D_TUNING.velocityDecayBias
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, physics2dVelocityDecayBias: clamped } } })
    },
    docKey: 'schema.layout.forces.physics2dVelocityDecayBias',
    default: () => DEFAULT_PHYSICS2D_TUNING.velocityDecayBias,
  },
  {
    key: 'schema.layout.forces.physics2dMaxSpeedScale',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { physics2dMaxSpeedScale?: unknown }).physics2dMaxSpeedScale
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_PHYSICS2D_TUNING.maxSpeedScale
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0.3, Math.min(3, next)) : DEFAULT_PHYSICS2D_TUNING.maxSpeedScale
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, physics2dMaxSpeedScale: clamped } } })
    },
    docKey: 'schema.layout.forces.physics2dMaxSpeedScale',
    default: () => DEFAULT_PHYSICS2D_TUNING.maxSpeedScale,
  },
  {
    key: 'schema.layout.forces.physics2dStrictOverlapScale',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { physics2dStrictOverlapScale?: unknown }).physics2dStrictOverlapScale
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_PHYSICS2D_TUNING.strictOverlapScale
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0.3, Math.min(3, next)) : DEFAULT_PHYSICS2D_TUNING.strictOverlapScale
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, physics2dStrictOverlapScale: clamped } } })
    },
    docKey: 'schema.layout.forces.physics2dStrictOverlapScale',
    default: () => DEFAULT_PHYSICS2D_TUNING.strictOverlapScale,
  },
  {
    key: 'schema.layout.forces.physics2dLabelNudgeScale',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { physics2dLabelNudgeScale?: unknown }).physics2dLabelNudgeScale
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_PHYSICS2D_TUNING.labelNudgeScale
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0.2, Math.min(3, next)) : DEFAULT_PHYSICS2D_TUNING.labelNudgeScale
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, physics2dLabelNudgeScale: clamped } } })
    },
    docKey: 'schema.layout.forces.physics2dLabelNudgeScale',
    default: () => DEFAULT_PHYSICS2D_TUNING.labelNudgeScale,
  },
  {
    key: 'schema.layout.forces.physics2dDragChargeScale',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { physics2dDragChargeScale?: unknown }).physics2dDragChargeScale
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_PHYSICS2D_TUNING.dragChargeScale
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0.1, Math.min(1, next)) : DEFAULT_PHYSICS2D_TUNING.dragChargeScale
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, physics2dDragChargeScale: clamped } } })
    },
    docKey: 'schema.layout.forces.physics2dDragChargeScale',
    default: () => DEFAULT_PHYSICS2D_TUNING.dragChargeScale,
  },
  {
    key: 'schema.layout.forces.physics2dDragDistanceMaxPx',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { physics2dDragDistanceMaxPx?: unknown }).physics2dDragDistanceMaxPx
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_PHYSICS2D_TUNING.dragDistanceMaxPx
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(120, Math.min(6000, next)) : DEFAULT_PHYSICS2D_TUNING.dragDistanceMaxPx
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, physics2dDragDistanceMaxPx: clamped } } })
    },
    docKey: 'schema.layout.forces.physics2dDragDistanceMaxPx',
    default: () => DEFAULT_PHYSICS2D_TUNING.dragDistanceMaxPx,
  },
  {
    key: 'schema.zoom.minScale',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema | null
      const v = schema?.performance?.zoom?.minScale
      return typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_ZOOM_MIN_SCALE
    },
    write: (v) => {
      const st = s()
      const schema = st.schema as GraphSchema
      const perf = schema.performance || {}
      const zoom = perf.zoom || {}
      st.setSchema({ ...schema, performance: { ...perf, zoom: { ...zoom, minScale: Number(v) } } } as GraphSchema)
    },
    docKey: 'schema.zoom.minScale',
    default: () => DEFAULT_ZOOM_MIN_SCALE,
  },
  {
    key: 'schema.layout.forces.radarSpokeDistancePx',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { radarSpokeDistancePx?: unknown }).radarSpokeDistancePx
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : 150
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(40, Math.min(1400, next)) : 150
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, radarSpokeDistancePx: clamped } } })
    },
    docKey: 'schema.layout.forces.radarSpokeDistancePx',
    default: () => 150,
  },
  {
    key: 'schema.layout.forces.radarFlowDistancePx',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { radarFlowDistancePx?: unknown }).radarFlowDistancePx
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : 360
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(60, Math.min(2400, next)) : 360
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, radarFlowDistancePx: clamped } } })
    },
    docKey: 'schema.layout.forces.radarFlowDistancePx',
    default: () => 360,
  },
  {
    key: 'schema.layout.forces.radarFlowCurveBend',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { radarFlowCurveBend?: unknown }).radarFlowCurveBend
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : 0.18
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(-0.8, Math.min(0.8, next)) : 0.18
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, radarFlowCurveBend: clamped } } })
    },
    docKey: 'schema.layout.forces.radarFlowCurveBend',
    default: () => 0.18,
  },
  {
    key: 'schema.layout.forces.radarFlowOrbitShift',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { radarFlowOrbitShift?: unknown }).radarFlowOrbitShift
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : 0.06
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0, Math.min(0.45, next)) : 0.06
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, radarFlowOrbitShift: clamped } } })
    },
    docKey: 'schema.layout.forces.radarFlowOrbitShift',
    default: () => 0.06,
  },
  {
    key: 'schema.layout.forces.radarFlowArrowLengthPx',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { radarFlowArrowLengthPx?: unknown }).radarFlowArrowLengthPx
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : 12
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(4, Math.min(30, next)) : 12
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, radarFlowArrowLengthPx: clamped } } })
    },
    docKey: 'schema.layout.forces.radarFlowArrowLengthPx',
    default: () => 12,
  },
  {
    key: 'schema.layout.forces.radarFlowArrowHalfWidthPx',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { radarFlowArrowHalfWidthPx?: unknown }).radarFlowArrowHalfWidthPx
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : 5.2
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(2, Math.min(14, next)) : 5.2
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, radarFlowArrowHalfWidthPx: clamped } } })
    },
    docKey: 'schema.layout.forces.radarFlowArrowHalfWidthPx',
    default: () => 5.2,
  },
  {
    key: 'schema.layout.forces.radarSpokeStrengthScale',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { radarSpokeStrengthScale?: unknown }).radarSpokeStrengthScale
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : 1
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0.2, Math.min(2.5, next)) : 1
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, radarSpokeStrengthScale: clamped } } })
    },
    docKey: 'schema.layout.forces.radarSpokeStrengthScale',
    default: () => 1,
  },
  {
    key: 'schema.layout.forces.radarFlowStrengthScale',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { radarFlowStrengthScale?: unknown }).radarFlowStrengthScale
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : 1
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0.2, Math.min(2.5, next)) : 1
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, radarFlowStrengthScale: clamped } } })
    },
    docKey: 'schema.layout.forces.radarFlowStrengthScale',
    default: () => 1,
  },
  {
    key: 'schema.layout.forces.radarNodeCharge',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { radarNodeCharge?: unknown }).radarNodeCharge
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : -110
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(-600, Math.min(-5, next)) : -110
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, radarNodeCharge: clamped } } })
    },
    docKey: 'schema.layout.forces.radarNodeCharge',
    default: () => -110,
  },
  {
    key: 'schema.layout.forces.radarHubCharge',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { radarHubCharge?: unknown }).radarHubCharge
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : -16
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(-120, Math.min(8, next)) : -16
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, radarHubCharge: clamped } } })
    },
    docKey: 'schema.layout.forces.radarHubCharge',
    default: () => -16,
  },
  {
    key: 'schema.layout.forces.radialOrbitEnabled',
    type: 'boolean',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { radialOrbitEnabled?: unknown }).radialOrbitEnabled
        : undefined
      return v === true
    },
    write: (v) => {
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, radialOrbitEnabled: Boolean(v) } } })
    },
    docKey: 'schema.layout.forces.radialOrbitEnabled',
    default: () => false,
  },
  {
    key: 'schema.layout.forces.radialOrbitSpeedDeg',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { radialOrbitSpeedDeg?: unknown }).radialOrbitSpeedDeg
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : 18
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0, Math.min(120, next)) : 18
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, radialOrbitSpeedDeg: clamped } } })
    },
    docKey: 'schema.layout.forces.radialOrbitSpeedDeg',
    default: () => 18,
  },
  {
    key: 'schema.layout.forces.radialOrbitSize',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { radialOrbitSize?: unknown }).radialOrbitSize
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : 2.95
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(1.2, Math.min(8, next)) : 2.95
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, radialOrbitSize: clamped } } })
    },
    docKey: 'schema.layout.forces.radialOrbitSize',
    default: () => 2.95,
  },
  {
    key: 'schema.layout.forces.radialOrbitRingGapPx',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { radialOrbitRingGapPx?: unknown }).radialOrbitRingGapPx
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : 58
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(12, Math.min(360, next)) : 58
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, radialOrbitRingGapPx: clamped } } })
    },
    docKey: 'schema.layout.forces.radialOrbitRingGapPx',
    default: () => 58,
  },
  {
    key: 'schema.layout.forces.radialOrbitDepthSpeedScale',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { radialOrbitDepthSpeedScale?: unknown }).radialOrbitDepthSpeedScale
        : undefined
      return typeof v === 'number' && Number.isFinite(v) ? v : 0.12
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0, Math.min(1.2, next)) : 0.12
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, radialOrbitDepthSpeedScale: clamped } } })
    },
    docKey: 'schema.layout.forces.radialOrbitDepthSpeedScale',
    default: () => 0.12,
  },
  {
    key: 'schema.layout.forces.radialOrbitMode',
    type: 'string',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      const v = schema.layout?.forces && typeof schema.layout.forces === 'object'
        ? (schema.layout.forces as { radialOrbitMode?: unknown }).radialOrbitMode
        : undefined
      const raw = typeof v === 'string' ? v : 'flat'
      return raw === 'solar' || raw === 'atomic' ? raw : 'flat'
    },
    write: (v) => {
      const raw = String(v || '')
      const mode = raw === 'solar' || raw === 'atomic' ? raw : 'flat'
      const current = s().schema as GraphSchema
      const layout = current.layout || {}
      const forces = layout.forces || {}
      s().setSchema({ ...current, layout: { ...layout, forces: { ...forces, radialOrbitMode: mode } } })
    },
    docKey: 'schema.layout.forces.radialOrbitMode',
    default: () => 'flat',
    options: ['flat', 'solar', 'atomic'],
  },
  {
    key: 'schema.zoom.maxScale',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema | null
      const v = schema?.performance?.zoom?.maxScale
      return typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_ZOOM_MAX_SCALE
    },
    write: (v) => {
      const st = s()
      const schema = st.schema as GraphSchema
      const perf = schema.performance || {}
      const zoom = perf.zoom || {}
      st.setSchema({ ...schema, performance: { ...perf, zoom: { ...zoom, maxScale: Number(v) } } } as GraphSchema)
    },
    docKey: 'schema.zoom.maxScale',
    default: () => DEFAULT_ZOOM_MAX_SCALE,
  },
  {
    key: 'zoom.labelScaleMode2d',
    type: 'string',
    source: 'store',
    read: () => s().zoomLabelScaleMode2d,
    write: (v) => {
      const raw = String(v || '')
      const next = raw === 'smooth' || raw === 'power' ? raw : 'clampAt1'
      s().setZoomLabelScaleMode2d(next as 'clampAt1' | 'smooth' | 'power')
    },
    docKey: 'zoom.labelScaleMode2d',
    default: () => 'clampAt1',
    options: ['clampAt1', 'smooth', 'power'],
  },
  {
    key: 'zoom.labelScaleExponent2d',
    type: 'number',
    source: 'store',
    read: () => s().zoomLabelScaleExponent2d,
    write: (v) => s().setZoomLabelScaleExponent2d(Number(v)),
    docKey: 'zoom.labelScaleExponent2d',
    default: () => 1,
  },
  {
    key: 'zoom.labelScaleClampMin2d',
    type: 'number',
    source: 'store',
    read: () => s().zoomLabelScaleClampMin2d,
    write: (v) => s().setZoomLabelScaleClampMin2d(Number(v)),
    docKey: 'zoom.labelScaleClampMin2d',
    default: () => 0.000001,
  },
  {
    key: 'zoom.labelScaleClampMax2d',
    type: 'number',
    source: 'store',
    read: () => s().zoomLabelScaleClampMax2d,
    write: (v) => s().setZoomLabelScaleClampMax2d(Number(v)),
    docKey: 'zoom.labelScaleClampMax2d',
    default: () => 1000000,
  },
  {
    key: 'zoom.strokeScaleMode2d',
    type: 'string',
    source: 'store',
    read: () => s().zoomStrokeScaleMode2d,
    write: (v) => {
      const raw = String(v || '')
      const next = raw === 'screenConstant' || raw === 'power' ? raw : 'zoomScaled'
      s().setZoomStrokeScaleMode2d(next as 'zoomScaled' | 'screenConstant' | 'power')
    },
    docKey: 'zoom.strokeScaleMode2d',
    default: () => 'zoomScaled',
    options: ['zoomScaled', 'screenConstant', 'power'],
  },
  {
    key: 'zoom.strokeScaleExponent2d',
    type: 'number',
    source: 'store',
    read: () => s().zoomStrokeScaleExponent2d,
    write: (v) => s().setZoomStrokeScaleExponent2d(Number(v)),
    docKey: 'zoom.strokeScaleExponent2d',
    default: () => 1,
  },
  {
    key: 'zoom.strokeScaleClampMin2d',
    type: 'number',
    source: 'store',
    read: () => s().zoomStrokeScaleClampMin2d,
    write: (v) => s().setZoomStrokeScaleClampMin2d(Number(v)),
    docKey: 'zoom.strokeScaleClampMin2d',
    default: () => 0.000001,
  },
  {
    key: 'zoom.strokeScaleClampMax2d',
    type: 'number',
    source: 'store',
    read: () => s().zoomStrokeScaleClampMax2d,
    write: (v) => s().setZoomStrokeScaleClampMax2d(Number(v)),
    docKey: 'zoom.strokeScaleClampMax2d',
    default: () => 1000,
  },
  {
    key: 'historyDebounceMs',
    type: 'number',
    source: 'store',
    read: () => s().historyDebounceMs,
    write: (v) => s().setHistoryDebounceMs(Number(v)),
    docKey: 'historyDebounceMs',
    default: () => 500,
  },
  {
    key: 'keyword.source.maxLines',
    type: 'number',
    source: 'store',
    read: () => s().keywordSourceMaxLines,
    write: (v) => s().setKeywordSourceMaxLines(Number(v)),
    docKey: 'keyword.source.maxLines',
    default: () => 8000,
  },
  {
    key: 'keyword.source.maxChars',
    type: 'number',
    source: 'store',
    read: () => s().keywordSourceMaxChars,
    write: (v) => s().setKeywordSourceMaxChars(Number(v)),
    docKey: 'keyword.source.maxChars',
    default: () => 120_000,
  },
  {
    key: 'keyword.graph.previewDebounceMs',
    type: 'number',
    source: 'store',
    read: () => s().keywordGraphPreviewDebounceMs,
    write: (v) => s().setKeywordGraphPreviewDebounceMs(Number(v)),
    docKey: 'keyword.graph.previewDebounceMs',
    default: () => 200,
  },
  {
    key: 'keyword.graph.fullDebounceMs',
    type: 'number',
    source: 'store',
    read: () => s().keywordGraphFullDebounceMs,
    write: (v) => s().setKeywordGraphFullDebounceMs(Number(v)),
    docKey: 'keyword.graph.fullDebounceMs',
    default: () => 800,
  },
  {
    key: 'keyword.graph.edgesPerNode',
    type: 'number',
    source: 'store',
    read: () => s().keywordGraphEdgesPerNode,
    write: (v) => s().setKeywordGraphEdgesPerNode(Number(v)),
    docKey: 'keyword.graph.edgesPerNode',
    default: () => 6,
  },
  {
    key: 'keyword.graph.maxEdges',
    type: 'number',
    source: 'store',
    read: () => s().keywordGraphMaxEdgesCap,
    write: (v) => s().setKeywordGraphMaxEdgesCap(Number(v)),
    docKey: 'keyword.graph.maxEdges',
    default: () => 2400,
  },
  {
    key: 'keyword.graph.mentionEdgesPerSourceNode',
    type: 'number',
    source: 'store',
    read: () => s().keywordGraphMentionEdgesPerSourceNode,
    write: (v) => s().setKeywordGraphMentionEdgesPerSourceNode(Number(v)),
    docKey: 'keyword.graph.mentionEdgesPerSourceNode',
    default: () => 6,
  },
  {
    key: 'codeHighlightDurationMs',
    type: 'number',
    source: 'store',
    read: () => s().codeHighlightDurationMs,
    write: (v) => s().setCodeHighlightDurationMs(Number(v)),
    docKey: 'codeHighlightDurationMs',
    default: () => 1000,
  },
  {
    key: 'codeSelectThrottleMs',
    type: 'number',
    source: 'store',
    read: () => s().codeSelectThrottleMs,
    write: (v) => s().setCodeSelectThrottleMs(Number(v)),
    docKey: 'codeSelectThrottleMs',
    default: () => 100,
  },
  {
    key: 'codeHighlightUntilClick',
    type: 'boolean',
    source: 'store',
    read: () => s().codeHighlightUntilClick,
    write: (v) => s().setCodeHighlightUntilClick(Boolean(v)),
    docKey: 'codeHighlightUntilClick',
    default: () => true,
  },
  {
    key: 'enableTabSync',
    type: 'boolean',
    source: 'store',
    read: () => s().enableTabSync,
    write: (v) => s().setEnableTabSync(Boolean(v)),
    docKey: 'enableTabSync',
    default: () => true,
  },
  {
    key: 'enableVirtualTables',
    type: 'boolean',
    source: 'store',
    read: () => s().enableVirtualTables,
    write: (v) => s().setEnableVirtualTables(Boolean(v)),
    docKey: 'enableVirtualTables',
    default: () => true,
  },
  {
    key: 'canvasRenderMode',
    type: 'string',
    source: 'store',
    read: () => s().canvasRenderMode,
    write: (v) => {
      const raw = String(v || '')
      const mode: '2d' | '3d' = raw === '3d' ? '3d' : '2d'
      s().setCanvasRenderMode(mode)
    },
    docKey: 'canvasRenderMode',
    default: () => '2d',
    options: ['2d', '3d'],
  },
  {
    key: 'viewportControlsPreset',
    type: 'string',
    source: 'store',
    read: () => s().viewportControlsPreset,
    write: (v) => {
      const raw = String(v || '')
      const preset = raw === 'design' ? 'design' : 'map'
      s().setViewportControlsPreset(preset)
    },
    docKey: 'viewportControlsPreset',
    default: () => 'map',
    options: ['map', 'design'],
  },
  {
    key: 'infiniteCanvasInteractionMode',
    type: 'string',
    source: 'store',
    read: () => s().infiniteCanvasInteractionMode,
    write: (v) => {
      const raw = String(v || '')
      const mode = raw === 'interactive' ? 'interactive' : 'static'
      s().setInfiniteCanvasInteractionMode(mode)
    },
    docKey: 'infiniteCanvasInteractionMode',
    default: () => 'static',
    options: ['static', 'interactive'],
  },
  {
    key: 'canvasWorkspaceSyncMode',
    type: 'string',
    source: 'store',
    read: () => s().canvasWorkspaceSyncMode,
    write: (v) => {
      const raw = String(v || '')
      const mode = raw === 'realtime' ? 'realtime' : 'manual'
      s().setCanvasWorkspaceSyncMode(mode)
    },
    docKey: 'canvasWorkspaceSyncMode',
    default: () => 'manual',
    options: ['manual', 'realtime'],
  },
  {
    key: 'flowEditorSelectionOnDrag',
    type: 'boolean',
    source: 'store',
    read: () => s().flowEditorSelectionOnDrag === true,
    write: (v) => s().setFlowEditorSelectionOnDrag(Boolean(v)),
    docKey: 'flowEditorSelectionOnDrag',
    default: () => false,
  },
  {
    key: 'flowEditorOverlayWheelProxyEnabled',
    type: 'boolean',
    source: 'store',
    read: () => s().flowEditorOverlayWheelProxyEnabled === true,
    write: (v) => s().setFlowEditorOverlayWheelProxyEnabled(Boolean(v)),
    docKey: 'flowEditorOverlayWheelProxyEnabled',
    default: () => true,
  },
  {
    key: 'viewPinned',
    type: 'boolean',
    source: 'store',
    read: () => s().viewPinned === true,
    write: (v) => s().setViewPinned(Boolean(v)),
    docKey: 'viewPinned',
    default: () => false,
  },
  {
    key: 'fitToScreenMode',
    type: 'boolean',
    source: 'store',
    read: () => s().fitToScreenMode === true,
    write: (v) => s().setFitToScreenMode(Boolean(v)),
    docKey: 'fitToScreenMode',
    default: () => true,
  },
  {
    key: 'zoomToSelectionMode',
    type: 'boolean',
    source: 'store',
    read: () => s().zoomToSelectionMode === true,
    write: (v) => s().setZoomToSelectionMode(Boolean(v)),
    docKey: 'zoomToSelectionMode',
    default: () => false,
  },
  {
    key: 'zoomDurationFitMs',
    type: 'number',
    source: 'store',
    read: () => s().zoomDurationFitMs,
    write: (v) => s().setZoomDurationFitMs(Number(v)),
    docKey: 'zoomDurationFitMs',
    default: () => 300,
  },
  {
    key: 'zoomDurationSelectionMs',
    type: 'number',
    source: 'store',
    read: () => s().zoomDurationSelectionMs,
    write: (v) => s().setZoomDurationSelectionMs(Number(v)),
    docKey: 'zoomDurationSelectionMs',
    default: () => 300,
  },
  {
    key: 'wheelZoomCtrlMetaBoostMultiplier',
    type: 'number',
    source: 'store',
    read: () => s().wheelZoomCtrlMetaBoostMultiplier,
    write: (v) => s().setWheelZoomCtrlMetaBoostMultiplier(Number(v)),
    docKey: 'wheelZoomCtrlMetaBoostMultiplier',
    default: () => CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_DEFAULT,
  },
  {
    key: 'canvasInteractionSpeedMultiplier',
    type: 'number',
    source: 'store',
    read: () => s().canvasInteractionSpeedMultiplier,
    write: (v) => s().setCanvasInteractionSpeedMultiplier(Number(v)),
    docKey: 'canvasInteractionSpeedMultiplier',
    default: () => CANVAS_INTERACTION_SPEED_MULTIPLIER_DEFAULT,
  },
  {
    key: 'canvasPanSpeedMultiplier',
    type: 'number',
    source: 'store',
    read: () => s().canvasPanSpeedMultiplier,
    write: (v) => s().setCanvasPanSpeedMultiplier(Number(v)),
    docKey: 'canvasPanSpeedMultiplier',
    default: () => CANVAS_PAN_SPEED_MULTIPLIER_DEFAULT,
  },
  {
    key: 'flowWheelZoomSpeedMultiplier',
    type: 'number',
    source: 'store',
    read: () => s().flowWheelZoomSpeedMultiplier,
    write: (v) => s().setFlowWheelZoomSpeedMultiplier(Number(v)),
    docKey: 'flowWheelZoomSpeedMultiplier',
    default: () => FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_DEFAULT,
  },
  {
    key: 'flowWheelZoomIncrementMultiplier',
    type: 'number',
    source: 'store',
    read: () => s().flowWheelZoomIncrementMultiplier,
    write: (v) => s().setFlowWheelZoomIncrementMultiplier(Number(v)),
    docKey: 'flowWheelZoomIncrementMultiplier',
    default: () => FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_DEFAULT,
  },
  {
    key: 'flowWheelZoomSmoothMinDurationMs',
    type: 'number',
    source: 'store',
    read: () => s().flowWheelZoomSmoothMinDurationMs,
    write: (v) => s().setFlowWheelZoomSmoothMinDurationMs(Number(v)),
    docKey: 'flowWheelZoomSmoothMinDurationMs',
    default: () => FLOW_WHEEL_ZOOM_SMOOTH_MIN_DURATION_DEFAULT_MS,
  },
  {
    key: 'flowWheelZoomSmoothMaxDurationMs',
    type: 'number',
    source: 'store',
    read: () => s().flowWheelZoomSmoothMaxDurationMs,
    write: (v) => s().setFlowWheelZoomSmoothMaxDurationMs(Number(v)),
    docKey: 'flowWheelZoomSmoothMaxDurationMs',
    default: () => FLOW_WHEEL_ZOOM_SMOOTH_MAX_DURATION_DEFAULT_MS,
  },
  {
    key: 'orchestratorTraversalDelayMs',
    type: 'number',
    source: 'localStorage',
    read: () => lsInt(LS_KEYS.orchestratorTraversalDelayMs, ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS),
    write: (v) => {
      lsSetInt(LS_KEYS.orchestratorTraversalDelayMs, Number(v), {
        min: ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS,
        max: ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS,
      })
    },
    docKey: 'orchestratorTraversalDelayMs',
    default: () => ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS,
  },
  {
    key: 'graph.behavior.selectMode',
    type: 'string',
    source: 'store',
    read: () => {
      const schema = s().schema
      const mode = schema.behavior?.selectMode
      if (mode === 'single' || mode === 'multi' || mode === 'lasso') return mode
      return 'single'
    },
    write: (v) => {
      const raw = String(v || '')
      const mode: 'single' | 'multi' | 'lasso' =
        raw === 'multi' || raw === 'lasso' ? (raw as 'multi' | 'lasso') : 'single'
      s().setSelectMode(mode)
    },
    docKey: 'graph.behavior.selectMode',
    default: () => 'single',
    options: ['single', 'multi', 'lasso'],
  },
  {
    key: 'graph.behavior.createMode',
    type: 'string',
    source: 'store',
    read: () => {
      const schema = s().schema
      const mode = schema.behavior?.createMode
      if (mode === 'click-source-target' || mode === 'panel-only') return mode
      return 'shift-drag'
    },
    write: (v) => {
      const raw = String(v || '')
      const mode: 'shift-drag' | 'click-source-target' | 'panel-only' =
        raw === 'click-source-target' || raw === 'panel-only'
          ? (raw as 'click-source-target' | 'panel-only')
          : 'shift-drag'
      s().setCreateMode(mode)
    },
    docKey: 'graph.behavior.createMode',
    default: () => 'shift-drag',
    options: ['shift-drag', 'click-source-target', 'panel-only'],
  },
  {
    key: 'schemaDeriveCacheCapacity',
    type: 'number',
    source: 'store',
    read: () => s().schemaDeriveCacheCapacity,
    write: (v) => s().setSchemaDeriveCacheCapacity(Number(v)),
    docKey: 'schemaDeriveCacheCapacity',
    default: () => 16,
  },
  {
    key: 'schema.behavior.hover.content.type',
    type: 'boolean',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.behavior?.hover?.content?.showType ?? true
    },
    write: (v) => {
      const current = s().schema
      const behavior = current.behavior
      const hover = behavior.hover || {}
      const content = hover.content || {}
      s().setSchema({
        ...current,
        behavior: {
          ...behavior,
          hover: {
            ...hover,
            content: { ...content, showType: Boolean(v) },
          },
        },
      })
    },
    docKey: 'schema.behavior.hover.content.type',
    default: () => true,
  },
  {
    key: 'schema.behavior.hover.content.id',
    type: 'boolean',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.behavior?.hover?.content?.showId ?? true
    },
    write: (v) => {
      const current = s().schema
      const behavior = current.behavior
      const hover = behavior.hover || {}
      const content = hover.content || {}
      s().setSchema({
        ...current,
        behavior: {
          ...behavior,
          hover: {
            ...hover,
            content: { ...content, showId: Boolean(v) },
          },
        },
      })
    },
    docKey: 'schema.behavior.hover.content.id',
    default: () => true,
  },
  {
    key: 'schema.behavior.hover.content.properties',
    type: 'boolean',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.behavior?.hover?.content?.showProps ?? true
    },
    write: (v) => {
      const current = s().schema
      const behavior = current.behavior
      const hover = behavior.hover || {}
      const content = hover.content || {}
      s().setSchema({
        ...current,
        behavior: {
          ...behavior,
          hover: {
            ...hover,
            content: { ...content, showProps: Boolean(v) },
          },
        },
      })
    },
    docKey: 'schema.behavior.hover.content.properties',
    default: () => true,
  },
  {
    key: 'schema.layout.groups.nestedPaddingStep',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw = schema.layout?.groups && typeof schema.layout.groups === 'object'
        ? (schema.layout.groups as { nestedPaddingStep?: unknown }).nestedPaddingStep
        : undefined
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0, Math.min(80, Math.floor(next))) : 0
      const current = s().schema
      const layout = current.layout || {}
      const groups = layout.groups || {}
      s().setSchema({
        ...current,
        layout: {
          ...layout,
          groups: { ...groups, nestedPaddingStep: clamped },
        },
      })
    },
    docKey: 'schema.layout.groups.nestedPaddingStep',
    default: () => 10,
  },
  {
    key: 'schema.layout.flow.pack.paddingPxDocument',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw =
        schema.layout?.flow && typeof schema.layout.flow === 'object'
          ? (schema.layout.flow as { pack?: { paddingPxDocument?: unknown } }).pack?.paddingPxDocument
          : undefined
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : 80
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0, Math.min(240, Math.floor(next))) : 80
      const current = s().schema
      const layout = current.layout || {}
      const flow = layout.flow || {}
      const pack = (flow as { pack?: Record<string, unknown> }).pack || {}
      s().setSchema({
        ...current,
        layout: {
          ...layout,
          flow: { ...flow, pack: { ...pack, paddingPxDocument: clamped } },
        },
      })
    },
    docKey: 'schema.layout.flow.pack.paddingPxDocument',
    default: () => 80,
  },
  {
    key: 'schema.layout.flow.pack.paddingPxKeyword',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw =
        schema.layout?.flow && typeof schema.layout.flow === 'object'
          ? (schema.layout.flow as { pack?: { paddingPxKeyword?: unknown } }).pack?.paddingPxKeyword
          : undefined
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : 64
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0, Math.min(240, Math.floor(next))) : 64
      const current = s().schema
      const layout = current.layout || {}
      const flow = layout.flow || {}
      const pack = (flow as { pack?: Record<string, unknown> }).pack || {}
      s().setSchema({
        ...current,
        layout: {
          ...layout,
          flow: { ...flow, pack: { ...pack, paddingPxKeyword: clamped } },
        },
      })
    },
    docKey: 'schema.layout.flow.pack.paddingPxKeyword',
    default: () => 64,
  },
  {
    key: 'schema.layout.flow.collisionCaps.nodePaddingXMax',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw =
        schema.layout?.flow && typeof schema.layout.flow === 'object'
          ? (schema.layout.flow as { collisionCaps?: { nodePaddingXMax?: unknown } }).collisionCaps?.nodePaddingXMax
          : undefined
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : 48
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0, Math.min(160, Math.floor(next))) : 48
      const current = s().schema
      const layout = current.layout || {}
      const flow = layout.flow || {}
      const collisionCaps = (flow as { collisionCaps?: Record<string, unknown> }).collisionCaps || {}
      s().setSchema({
        ...current,
        layout: {
          ...layout,
          flow: { ...flow, collisionCaps: { ...collisionCaps, nodePaddingXMax: clamped } },
        },
      })
    },
    docKey: 'schema.layout.flow.collisionCaps.nodePaddingXMax',
    default: () => 48,
  },
  {
    key: 'schema.layout.flow.collisionCaps.nodePaddingYMax',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw =
        schema.layout?.flow && typeof schema.layout.flow === 'object'
          ? (schema.layout.flow as { collisionCaps?: { nodePaddingYMax?: unknown } }).collisionCaps?.nodePaddingYMax
          : undefined
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : 36
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0, Math.min(160, Math.floor(next))) : 36
      const current = s().schema
      const layout = current.layout || {}
      const flow = layout.flow || {}
      const collisionCaps = (flow as { collisionCaps?: Record<string, unknown> }).collisionCaps || {}
      s().setSchema({
        ...current,
        layout: {
          ...layout,
          flow: { ...flow, collisionCaps: { ...collisionCaps, nodePaddingYMax: clamped } },
        },
      })
    },
    docKey: 'schema.layout.flow.collisionCaps.nodePaddingYMax',
    default: () => 36,
  },
  {
    key: 'schema.layout.flow.collisionCaps.groupExtraGapPxMax',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw =
        schema.layout?.flow && typeof schema.layout.flow === 'object'
          ? (schema.layout.flow as { collisionCaps?: { groupExtraGapPxMax?: unknown } }).collisionCaps?.groupExtraGapPxMax
          : undefined
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : 48
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0, Math.min(240, Math.floor(next))) : 48
      const current = s().schema
      const layout = current.layout || {}
      const flow = layout.flow || {}
      const collisionCaps = (flow as { collisionCaps?: Record<string, unknown> }).collisionCaps || {}
      s().setSchema({
        ...current,
        layout: {
          ...layout,
          flow: { ...flow, collisionCaps: { ...collisionCaps, groupExtraGapPxMax: clamped } },
        },
      })
    },
    docKey: 'schema.layout.flow.collisionCaps.groupExtraGapPxMax',
    default: () => 48,
  },
  {
    key: 'schema.layout.flow.collisionCaps.maxShiftPx',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw =
        schema.layout?.flow && typeof schema.layout.flow === 'object'
          ? (schema.layout.flow as { collisionCaps?: { maxShiftPx?: unknown } }).collisionCaps?.maxShiftPx
          : undefined
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : 220
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(40, Math.min(800, Math.floor(next))) : 220
      const current = s().schema
      const layout = current.layout || {}
      const flow = layout.flow || {}
      const collisionCaps = (flow as { collisionCaps?: Record<string, unknown> }).collisionCaps || {}
      s().setSchema({
        ...current,
        layout: {
          ...layout,
          flow: { ...flow, collisionCaps: { ...collisionCaps, maxShiftPx: clamped } },
        },
      })
    },
    docKey: 'schema.layout.flow.collisionCaps.maxShiftPx',
    default: () => 220,
  },
  {
    key: 'schema.layout.flow.overlay.collisionGapPx',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw =
        schema.layout?.flow && typeof schema.layout.flow === 'object'
          ? (schema.layout.flow as { overlay?: { collisionGapPx?: unknown } }).overlay?.collisionGapPx
          : undefined
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : 12
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0, Math.min(40, Math.floor(next))) : 12
      const current = s().schema
      const layout = current.layout || {}
      const flow = layout.flow || {}
      const overlay = (flow as { overlay?: Record<string, unknown> }).overlay || {}
      s().setSchema({
        ...current,
        layout: {
          ...layout,
          flow: { ...flow, overlay: { ...overlay, collisionGapPx: clamped } },
        },
      })
    },
    docKey: 'schema.layout.flow.overlay.collisionGapPx',
    default: () => 12,
  },
  {
    key: 'schema.layout.edges.type',
    type: 'string',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw = schema.layout?.edges && typeof schema.layout.edges === 'object'
        ? (schema.layout.edges as { type?: unknown }).type
        : undefined
      const v = String(raw || '').trim().toLowerCase()
      if (v === 'straight' || v === 'step' || v === 'smoothstep' || v === 'bezier') return v
      return 'bezier'
    },
    write: (v) => {
      const raw = String(v || '').trim().toLowerCase()
      const next = raw === 'straight' || raw === 'step' || raw === 'smoothstep' || raw === 'bezier' ? raw : 'bezier'
      const current = s().schema
      const layout = current.layout || {}
      const edges = layout.edges || {}
      s().setSchema({
        ...current,
        layout: {
          ...layout,
          edges: { ...edges, type: next },
        },
      })
    },
    docKey: 'schema.layout.edges.type',
    default: () => 'bezier',
    options: ['bezier', 'straight', 'step', 'smoothstep'],
  },
  {
    key: 'schema.layout.edges.opacity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw = schema.layout?.edges && typeof schema.layout.edges === 'object'
        ? (schema.layout.edges as { opacity?: unknown }).opacity
        : undefined
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0.6
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : 0.6
      const current = s().schema
      const layout = current.layout || {}
      const edges = layout.edges || {}
      s().setSchema({
        ...current,
        layout: {
          ...layout,
          edges: { ...edges, opacity: clamped },
        },
      })
    },
    docKey: 'schema.layout.edges.opacity',
    default: () => 0.6,
  },
  {
    key: 'schema.layout.edges.opacityUnderGroups',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw = schema.layout?.edges && typeof schema.layout.edges === 'object'
        ? (schema.layout.edges as { opacityUnderGroups?: unknown }).opacityUnderGroups
        : undefined
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0.45
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : 0.45
      const current = s().schema
      const layout = current.layout || {}
      const edges = layout.edges || {}
      s().setSchema({
        ...current,
        layout: {
          ...layout,
          edges: { ...edges, opacityUnderGroups: clamped },
        },
      })
    },
    docKey: 'schema.layout.edges.opacityUnderGroups',
    default: () => 0.45,
  },
  {
    key: 'graphHoverPreview.showNodeId',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showNodeId,
    write: (v) => s().setGraphHoverPreviewConfig({ showNodeId: Boolean(v) }),
    docKey: 'graphHoverPreview.showNodeId',
    default: () => false,
  },
  {
    key: 'graphHoverPreview.showNodeName',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showNodeName,
    write: (v) => s().setGraphHoverPreviewConfig({ showNodeName: Boolean(v) }),
    docKey: 'graphHoverPreview.showNodeName',
    default: () => true,
  },
  {
    key: 'graphHoverPreview.showNodeLabel',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showNodeLabel,
    write: (v) => s().setGraphHoverPreviewConfig({ showNodeLabel: Boolean(v) }),
    docKey: 'graphHoverPreview.showNodeLabel',
    default: () => true,
  },
  {
    key: 'graphHoverPreview.showNodeDescription',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showNodeDescription,
    write: (v) => s().setGraphHoverPreviewConfig({ showNodeDescription: Boolean(v) }),
    docKey: 'graphHoverPreview.showNodeDescription',
    default: () => true,
  },
  {
    key: 'graphHoverPreview.showNodeProperties',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showNodeProperties,
    write: (v) => s().setGraphHoverPreviewConfig({ showNodeProperties: Boolean(v) }),
    docKey: 'graphHoverPreview.showNodeProperties',
    default: () => true,
  },
  {
    key: 'graphHoverPreview.showEdgeId',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showEdgeId,
    write: (v) => s().setGraphHoverPreviewConfig({ showEdgeId: Boolean(v) }),
    docKey: 'graphHoverPreview.showEdgeId',
    default: () => false,
  },
  {
    key: 'graphHoverPreview.showEdgeLabel',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showEdgeLabel,
    write: (v) => s().setGraphHoverPreviewConfig({ showEdgeLabel: Boolean(v) }),
    docKey: 'graphHoverPreview.showEdgeLabel',
    default: () => true,
  },
  {
    key: 'graphHoverPreview.showEdgeWeight',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showEdgeWeight,
    write: (v) => s().setGraphHoverPreviewConfig({ showEdgeWeight: Boolean(v) }),
    docKey: 'graphHoverPreview.showEdgeWeight',
    default: () => true,
  },
  {
    key: 'graphHoverPreview.showEdgeProperties',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showEdgeProperties,
    write: (v) => s().setGraphHoverPreviewConfig({ showEdgeProperties: Boolean(v) }),
    docKey: 'graphHoverPreview.showEdgeProperties',
    default: () => true,
  },
]
