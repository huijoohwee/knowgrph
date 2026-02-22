import { getPortHandlesConfig } from '@/components/GraphCanvas/portHandlesConfig'
import { readGroupLabelTopExtra } from '@/components/GraphCanvas/layout/collisionConfig'
import type { GraphSchema } from '@/lib/graph/schema'

export function readFlowPresentation(args: { schema: GraphSchema | null; documentSemanticMode?: 'document' | 'keyword' }) {
  const schema = args.schema
  const s = schema
  const portCfg = s
    ? getPortHandlesConfig(s)
    : { enabled: false, placement: 'cardinal' as const, size: 4, offset: 2, strokeWidth: 1.5, stroke: '', fill: '' }
  const groupsCfg = s?.layout?.groups || {}
  const groupsEnabled = groupsCfg.enabled !== false
  const shape: 'rect' | 'geo' = groupsCfg.shape === 'geo' ? 'geo' : 'rect'
  const paddingPx = typeof groupsCfg.padding === 'number' && Number.isFinite(groupsCfg.padding) ? Math.max(0, groupsCfg.padding) : 24
  const labelTopExtraPx = s ? readGroupLabelTopExtra(s) : 0
  const cornerRadiusPx = typeof groupsCfg.cornerRadius === 'number' && Number.isFinite(groupsCfg.cornerRadius) ? Math.max(0, groupsCfg.cornerRadius) : 12
  const strokeWidthPx = typeof groupsCfg.strokeWidth === 'number' && Number.isFinite(groupsCfg.strokeWidth) ? Math.max(0, groupsCfg.strokeWidth) : 1.5
  const fillOpacity = typeof groupsCfg.fillOpacity === 'number' && Number.isFinite(groupsCfg.fillOpacity) ? Math.max(0, Math.min(1, groupsCfg.fillOpacity)) : 0.08

  const depthStyleCfg = (groupsCfg as typeof groupsCfg & { depthStyle?: unknown }).depthStyle as
    | { enabled?: unknown; outerMaxBoostSteps?: unknown; outerStrokeWidthStepPx?: unknown; outerFillOpacityStep?: unknown }
    | undefined
  const depthStyle = {
    enabled: depthStyleCfg?.enabled !== false,
    outerMaxBoostSteps:
      typeof depthStyleCfg?.outerMaxBoostSteps === 'number' && Number.isFinite(depthStyleCfg.outerMaxBoostSteps)
        ? Math.max(0, Math.floor(depthStyleCfg.outerMaxBoostSteps))
        : 3,
    outerStrokeWidthStepPx:
      typeof depthStyleCfg?.outerStrokeWidthStepPx === 'number' && Number.isFinite(depthStyleCfg.outerStrokeWidthStepPx)
        ? Math.max(0, depthStyleCfg.outerStrokeWidthStepPx)
        : 0.55,
    outerFillOpacityStep:
      typeof depthStyleCfg?.outerFillOpacityStep === 'number' && Number.isFinite(depthStyleCfg.outerFillOpacityStep)
        ? Math.max(0, depthStyleCfg.outerFillOpacityStep)
        : 0.035,
  }

  const flowEdges = (s?.layout?.flow || {}) as unknown as {
    edges?: {
      routing?: { enabled?: unknown; mode?: unknown; obstacleAvoidance?: unknown; marginPx?: unknown; laneStepPx?: unknown; maxLanes?: unknown }
      underlay?: { enabled?: unknown; groupFadeAlpha?: unknown }
    }
  }
  const routingRaw = flowEdges.edges?.routing || {}
  const underlayRaw = flowEdges.edges?.underlay || {}
  const edgesPresentation = {
    routing: {
      enabled: routingRaw.enabled !== false,
      mode: routingRaw.mode === 'bezier' ? ('bezier' as const) : ('ortho' as const),
      obstacleAvoidance: routingRaw.obstacleAvoidance !== false,
      marginPx: typeof routingRaw.marginPx === 'number' && Number.isFinite(routingRaw.marginPx) ? Math.max(0, routingRaw.marginPx) : 10,
      laneStepPx: typeof routingRaw.laneStepPx === 'number' && Number.isFinite(routingRaw.laneStepPx) ? Math.max(4, routingRaw.laneStepPx) : 56,
      maxLanes: typeof routingRaw.maxLanes === 'number' && Number.isFinite(routingRaw.maxLanes) ? Math.max(1, Math.floor(routingRaw.maxLanes)) : 10,
    },
    underlay: {
      enabled: underlayRaw.enabled !== false,
      groupFadeAlpha:
        typeof underlayRaw.groupFadeAlpha === 'number' && Number.isFinite(underlayRaw.groupFadeAlpha)
          ? Math.max(0, Math.min(1, underlayRaw.groupFadeAlpha))
          : 0.65,
    },
  }

  return {
    labels: (() => {
      const baseRaw = s?.labelStyles?.fontSize
      const base = typeof baseRaw === 'number' && Number.isFinite(baseRaw) ? Math.max(10, Math.min(26, baseRaw)) : 12
      const semanticBoost = args.documentSemanticMode === 'document' ? 4 : 3
      const nodeFontSizePx = Math.max(14, Math.min(22, Math.round(base + semanticBoost)))
      const groupFontSizePx = Math.max(12, Math.min(26, Math.round(nodeFontSizePx + 2)))
      const edgeFontSizePx = Math.max(10, Math.min(18, Math.round(base + 0)))
      return { nodeFontSizePx, groupFontSizePx, edgeFontSizePx }
    })(),
    portHandles: {
      enabled: portCfg.enabled,
      placement: 'cardinal' as const,
      sizePx: portCfg.size,
      offsetPx: portCfg.offset,
      strokeWidthPx: portCfg.strokeWidth,
    },
    groups: {
      enabled: groupsEnabled,
      shape,
      paddingPx,
      labelTopExtraPx,
      cornerRadiusPx,
      strokeWidthPx,
      fillOpacity,
      depthStyle,
    },
    edges: edgesPresentation,
  }
}
