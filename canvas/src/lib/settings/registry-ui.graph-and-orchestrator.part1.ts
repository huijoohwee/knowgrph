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
import type { SettingMeta } from '@/features/settings/types'
import {
  FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO,
  FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_DESKTOP,
  FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_LAPTOP,
  FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_PHONE,
  FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_TABLET,
} from '@/components/FlowCanvas/frontmatterLayoutConfig'
import {
  JSON_IMPORT_WORKSPACE_TARGET_OPTIONS,
  readJsonImportWorkspaceTarget,
  writeJsonImportWorkspaceTarget,
} from '@/features/workspace-table/jsonImportWorkspaceTarget'

const s = () => useGraphStore.getState()

export const uiGraphAndOrchestratorSettingsRegistryPart1: SettingMeta[] = [
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
    key: 'viewport.fitReferenceWidth',
    type: 'number',
    source: 'store',
    read: () => s().viewportFitReferenceWidth,
    write: (v) => s().setViewportFitReferenceWidth(Number(v)),
    docKey: 'viewport.fitReferenceWidth',
    default: () => 1920,
  },
  {
    key: 'viewport.fitReferenceHeight',
    type: 'number',
    source: 'store',
    read: () => s().viewportFitReferenceHeight,
    write: (v) => s().setViewportFitReferenceHeight(Number(v)),
    docKey: 'viewport.fitReferenceHeight',
    default: () => 1080,
  },
  {
    key: 'flow.frontmatter.initialFitFillRatio',
    type: 'number',
    source: 'store',
    read: () => s().frontmatterFlowInitialFitFillRatio,
    write: (v) => s().setFrontmatterFlowInitialFitFillRatio(Number(v)),
    docKey: 'flow.frontmatter.initialFitFillRatio',
    default: () => FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO,
  },
  {
    key: 'flow.frontmatter.overlayFitProxyScale.phone',
    type: 'number',
    source: 'store',
    read: () => s().frontmatterFlowOverlayFitProxyScalePhone,
    write: (v) => s().setFrontmatterFlowOverlayFitProxyScalePhone(Number(v)),
    docKey: 'flow.frontmatter.overlayFitProxyScale.phone',
    default: () => FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_PHONE,
  },
  {
    key: 'flow.frontmatter.overlayFitProxyScale.tablet',
    type: 'number',
    source: 'store',
    read: () => s().frontmatterFlowOverlayFitProxyScaleTablet,
    write: (v) => s().setFrontmatterFlowOverlayFitProxyScaleTablet(Number(v)),
    docKey: 'flow.frontmatter.overlayFitProxyScale.tablet',
    default: () => FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_TABLET,
  },
  {
    key: 'flow.frontmatter.overlayFitProxyScale.laptop',
    type: 'number',
    source: 'store',
    read: () => s().frontmatterFlowOverlayFitProxyScaleLaptop,
    write: (v) => s().setFrontmatterFlowOverlayFitProxyScaleLaptop(Number(v)),
    docKey: 'flow.frontmatter.overlayFitProxyScale.laptop',
    default: () => FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_LAPTOP,
  },
  {
    key: 'flow.frontmatter.overlayFitProxyScale.desktop',
    type: 'number',
    source: 'store',
    read: () => s().frontmatterFlowOverlayFitProxyScaleDesktop,
    write: (v) => s().setFrontmatterFlowOverlayFitProxyScaleDesktop(Number(v)),
    docKey: 'flow.frontmatter.overlayFitProxyScale.desktop',
    default: () => FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_DESKTOP,
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
]
