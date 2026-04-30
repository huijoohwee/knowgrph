
import type { StoreApi } from 'zustand'
import type { GraphState } from './types'
import { LS_KEYS } from '@/lib/config.ls.keys'
import { lsSetBool, lsSetFloat, lsSetInt } from '@/lib/persistence'
import { clampFloat, clampInt, type UiStorageReaders } from './uiSliceStorage'

type SetGraph = StoreApi<GraphState>['setState']

export const createUiSettingsRenderSlice = (set: SetGraph, readers: UiStorageReaders)=> {
  const { lsBool, lsFloat, lsInt, readLsString, writeLsString } = readers
  return {
  richMediaPanelMode: (() => {
    const raw = readLsString(LS_KEYS.renderRichMediaPanelMode, 'snapshot')
    return (raw === 'embed' ? 'embed' : 'snapshot') as 'snapshot' | 'embed'
  })(),
  setRichMediaPanelMode: (v: 'snapshot' | 'embed') => {
    const next = v === 'embed' ? 'embed' : 'snapshot'
    writeLsString(LS_KEYS.renderRichMediaPanelMode, next)
    set({ richMediaPanelMode: next })
  },

  bipartiteDataSource: (() => {
    const raw = readLsString(LS_KEYS.bipartiteDataSource, 'workspace')
    return (raw === 'fixture' ? 'fixture' : raw === 'workspace' ? 'workspace' : 'api') as 'api' | 'fixture' | 'workspace'
  })(),
  setBipartiteDataSource: (v: 'api' | 'fixture' | 'workspace') => {
    const next = v === 'fixture' ? 'fixture' : v === 'workspace' ? 'workspace' : 'api'
    writeLsString(LS_KEYS.bipartiteDataSource, next)
    set({ bipartiteDataSource: next })
  },
  bipartiteApiRunId: readLsString(LS_KEYS.bipartiteApiRunId, ''),
  setBipartiteApiRunId: (v: string) => {
    const next = writeLsString(LS_KEYS.bipartiteApiRunId, v)
    set({ bipartiteApiRunId: next })
  },
  bipartitePollIntervalSec: clampInt(lsInt(LS_KEYS.bipartitePollIntervalSec, 60), 60, { min: 3, max: 3600 }),
  setBipartitePollIntervalSec: (v: number) =>
    set({ bipartitePollIntervalSec: lsSetInt(LS_KEYS.bipartitePollIntervalSec, v, { min: 3, max: 3600 }) }),

  bipartiteNodeSizeMetric: (() => {
    const raw = readLsString(LS_KEYS.bipartiteNodeSizeMetric, 'gap_score')
    const next = raw === 'pmf_score' || raw === 'gap_velocity' || raw === 'source_count' || raw === 'none' ? raw : 'gap_score'
    return next as 'gap_score' | 'pmf_score' | 'gap_velocity' | 'source_count' | 'none'
  })(),
  setBipartiteNodeSizeMetric: (v: 'gap_score' | 'pmf_score' | 'gap_velocity' | 'source_count' | 'none') => {
    const next = v === 'pmf_score' || v === 'gap_velocity' || v === 'source_count' || v === 'none' ? v : 'gap_score'
    writeLsString(LS_KEYS.bipartiteNodeSizeMetric, next)
    set({ bipartiteNodeSizeMetric: next })
  },
  bipartiteNodeGlowMetric: (() => {
    const raw = readLsString(LS_KEYS.bipartiteNodeGlowMetric, 'pmf_score')
    const next = raw === 'gap_score' || raw === 'none' ? raw : 'pmf_score'
    return next as 'pmf_score' | 'gap_score' | 'none'
  })(),
  setBipartiteNodeGlowMetric: (v: 'pmf_score' | 'gap_score' | 'none') => {
    const next = v === 'gap_score' || v === 'none' ? v : 'pmf_score'
    writeLsString(LS_KEYS.bipartiteNodeGlowMetric, next)
    set({ bipartiteNodeGlowMetric: next })
  },
  bipartiteNodePulseMetric: (() => {
    const raw = readLsString(LS_KEYS.bipartiteNodePulseMetric, 'gap_velocity')
    const next = raw === 'pmf_score' || raw === 'none' ? raw : 'gap_velocity'
    return next as 'gap_velocity' | 'pmf_score' | 'none'
  })(),
  setBipartiteNodePulseMetric: (v: 'gap_velocity' | 'pmf_score' | 'none') => {
    const next = v === 'pmf_score' || v === 'none' ? v : 'gap_velocity'
    writeLsString(LS_KEYS.bipartiteNodePulseMetric, next)
    set({ bipartiteNodePulseMetric: next })
  },
  bipartiteNodeBorderMetric: (() => {
    const raw = readLsString(LS_KEYS.bipartiteNodeBorderMetric, 'source_count')
    const next = raw === 'gap_score' || raw === 'none' ? raw : 'source_count'
    return next as 'source_count' | 'gap_score' | 'none'
  })(),
  setBipartiteNodeBorderMetric: (v: 'source_count' | 'gap_score' | 'none') => {
    const next = v === 'gap_score' || v === 'none' ? v : 'source_count'
    writeLsString(LS_KEYS.bipartiteNodeBorderMetric, next)
    set({ bipartiteNodeBorderMetric: next })
  },
  bipartiteEdgeOpacityMetric: (() => {
    const raw = readLsString(LS_KEYS.bipartiteEdgeOpacityMetric, 'strength')
    return (raw === 'none' ? 'none' : 'strength') as 'strength' | 'none'
  })(),
  setBipartiteEdgeOpacityMetric: (v: 'strength' | 'none') => {
    const next = v === 'none' ? 'none' : 'strength'
    writeLsString(LS_KEYS.bipartiteEdgeOpacityMetric, next)
    set({ bipartiteEdgeOpacityMetric: next })
  },

  bipartiteShowSpecificityBadges: lsBool(LS_KEYS.bipartiteShowSpecificityBadges, true),
  setBipartiteShowSpecificityBadges: (v: boolean) =>
    set({ bipartiteShowSpecificityBadges: lsSetBool(LS_KEYS.bipartiteShowSpecificityBadges, v) }),
  bipartiteShowGapScoreInLabel: lsBool(LS_KEYS.bipartiteShowGapScoreInLabel, true),
  setBipartiteShowGapScoreInLabel: (v: boolean) =>
    set({ bipartiteShowGapScoreInLabel: lsSetBool(LS_KEYS.bipartiteShowGapScoreInLabel, v) }),
  bipartiteShowClusterGapRatio: lsBool(LS_KEYS.bipartiteShowClusterGapRatio, true),
  setBipartiteShowClusterGapRatio: (v: boolean) =>
    set({ bipartiteShowClusterGapRatio: lsSetBool(LS_KEYS.bipartiteShowClusterGapRatio, v) }),

  threeIframeOverlayPoolMax: clampInt(lsInt(LS_KEYS.renderThreeIframeOverlayPoolMax, 24), 24, { min: 1, max: 200 }),
  setThreeIframeOverlayPoolMax: (v: number) => set({ threeIframeOverlayPoolMax: lsSetInt(LS_KEYS.renderThreeIframeOverlayPoolMax, v, { min: 1, max: 200 }) }),

  threeIframeOverlayMaxVisibleDefault: clampInt(lsInt(LS_KEYS.renderThreeIframeOverlayMaxVisibleDefault, 8), 8, { min: 0, max: 50 }),
  setThreeIframeOverlayMaxVisibleDefault: (v: number) => set({ threeIframeOverlayMaxVisibleDefault: lsSetInt(LS_KEYS.renderThreeIframeOverlayMaxVisibleDefault, v, { min: 0, max: 50 }) }),

  threeIframeOverlayMaxVisibleCompact: clampInt(lsInt(LS_KEYS.renderThreeIframeOverlayMaxVisibleCompact, 6), 6, { min: 0, max: 50 }),
  setThreeIframeOverlayMaxVisibleCompact: (v: number) => set({ threeIframeOverlayMaxVisibleCompact: lsSetInt(LS_KEYS.renderThreeIframeOverlayMaxVisibleCompact, v, { min: 0, max: 50 }) }),

  threeIframeOverlayMaxDistanceDefault: clampFloat(lsFloat(LS_KEYS.renderThreeIframeOverlayMaxDistanceDefault, 620, { min: 60, max: 5000 }), 620, { min: 60, max: 5000 }),
  setThreeIframeOverlayMaxDistanceDefault: (v: number) => set({ threeIframeOverlayMaxDistanceDefault: lsSetFloat(LS_KEYS.renderThreeIframeOverlayMaxDistanceDefault, v, { min: 60, max: 5000 }) }),

  threeIframeOverlayMaxDistanceCompact: clampFloat(lsFloat(LS_KEYS.renderThreeIframeOverlayMaxDistanceCompact, 520, { min: 60, max: 5000 }), 520, { min: 60, max: 5000 }),
  setThreeIframeOverlayMaxDistanceCompact: (v: number) => set({ threeIframeOverlayMaxDistanceCompact: lsSetFloat(LS_KEYS.renderThreeIframeOverlayMaxDistanceCompact, v, { min: 60, max: 5000 }) }),

  threeIframeOverlayBaseWidthRatioDefault: clampFloat(lsFloat(LS_KEYS.renderThreeIframeOverlayBaseWidthRatioDefault, 0.2, { min: 0.05, max: 0.9 }), 0.2, { min: 0.05, max: 0.9 }),
  setThreeIframeOverlayBaseWidthRatioDefault: (v: number) => set({ threeIframeOverlayBaseWidthRatioDefault: lsSetFloat(LS_KEYS.renderThreeIframeOverlayBaseWidthRatioDefault, v, { min: 0.05, max: 0.9 }) }),

  threeIframeOverlayBaseWidthRatioCompact: clampFloat(lsFloat(LS_KEYS.renderThreeIframeOverlayBaseWidthRatioCompact, 0.16, { min: 0.05, max: 0.9 }), 0.16, { min: 0.05, max: 0.9 }),
  setThreeIframeOverlayBaseWidthRatioCompact: (v: number) => set({ threeIframeOverlayBaseWidthRatioCompact: lsSetFloat(LS_KEYS.renderThreeIframeOverlayBaseWidthRatioCompact, v, { min: 0.05, max: 0.9 }) }),

  threeIframeOverlayBaseWidthMinPxDefault: clampInt(lsInt(LS_KEYS.renderThreeIframeOverlayBaseWidthMinPxDefault, 210), 210, { min: 80, max: 4000 }),
  setThreeIframeOverlayBaseWidthMinPxDefault: (v: number) => set({ threeIframeOverlayBaseWidthMinPxDefault: lsSetInt(LS_KEYS.renderThreeIframeOverlayBaseWidthMinPxDefault, v, { min: 80, max: 4000 }) }),

  threeIframeOverlayBaseWidthMinPxCompact: clampInt(lsInt(LS_KEYS.renderThreeIframeOverlayBaseWidthMinPxCompact, 180), 180, { min: 80, max: 4000 }),
  setThreeIframeOverlayBaseWidthMinPxCompact: (v: number) => set({ threeIframeOverlayBaseWidthMinPxCompact: lsSetInt(LS_KEYS.renderThreeIframeOverlayBaseWidthMinPxCompact, v, { min: 80, max: 4000 }) }),

  threeIframeOverlayBaseWidthMaxPxDefault: clampInt(lsInt(LS_KEYS.renderThreeIframeOverlayBaseWidthMaxPxDefault, 360), 360, { min: 80, max: 4000 }),
  setThreeIframeOverlayBaseWidthMaxPxDefault: (v: number) => set({ threeIframeOverlayBaseWidthMaxPxDefault: lsSetInt(LS_KEYS.renderThreeIframeOverlayBaseWidthMaxPxDefault, v, { min: 80, max: 4000 }) }),

  threeIframeOverlayBaseWidthMaxPxCompact: clampInt(lsInt(LS_KEYS.renderThreeIframeOverlayBaseWidthMaxPxCompact, 300), 300, { min: 80, max: 4000 }),
  setThreeIframeOverlayBaseWidthMaxPxCompact: (v: number) => set({ threeIframeOverlayBaseWidthMaxPxCompact: lsSetInt(LS_KEYS.renderThreeIframeOverlayBaseWidthMaxPxCompact, v, { min: 80, max: 4000 }) }),

  zoomLabelScaleMode2d: (() => {
    const raw = readLsString(LS_KEYS.zoomLabelScaleMode2d, 'clampAt1')
    const next = raw === 'smooth' || raw === 'power' ? raw : 'clampAt1'
    return next as 'clampAt1' | 'smooth' | 'power'
  })(),
  setZoomLabelScaleMode2d: (v: 'clampAt1' | 'smooth' | 'power') => {
    const next = v === 'smooth' || v === 'power' ? v : 'clampAt1'
    writeLsString(LS_KEYS.zoomLabelScaleMode2d, next)
    set({ zoomLabelScaleMode2d: next })
  },
  zoomLabelScaleExponent2d: clampFloat(lsFloat(LS_KEYS.zoomLabelScaleExponent2d, 1, { min: 0.05, max: 4 }), 1, { min: 0.05, max: 4 }),
  setZoomLabelScaleExponent2d: (v: number) => set({ zoomLabelScaleExponent2d: lsSetFloat(LS_KEYS.zoomLabelScaleExponent2d, v, { min: 0.05, max: 4 }) }),
  zoomLabelScaleClampMin2d: clampFloat(lsFloat(LS_KEYS.zoomLabelScaleClampMin2d, 0.000001, { min: 0.000001, max: 10 }), 0.000001, { min: 0.000001, max: 10 }),
  setZoomLabelScaleClampMin2d: (v: number) => set({ zoomLabelScaleClampMin2d: lsSetFloat(LS_KEYS.zoomLabelScaleClampMin2d, v, { min: 0.000001, max: 10 }) }),
  zoomLabelScaleClampMax2d: clampFloat(lsFloat(LS_KEYS.zoomLabelScaleClampMax2d, 1000000, { min: 1, max: 1000000 }), 1000000, { min: 1, max: 1000000 }),
  setZoomLabelScaleClampMax2d: (v: number) => set({ zoomLabelScaleClampMax2d: lsSetFloat(LS_KEYS.zoomLabelScaleClampMax2d, v, { min: 1, max: 1000000 }) }),

  zoomStrokeScaleMode2d: (() => {
    const raw = readLsString(LS_KEYS.zoomStrokeScaleMode2d, 'zoomScaled')
    const next = raw === 'screenConstant' || raw === 'power' ? raw : 'zoomScaled'
    return next as 'zoomScaled' | 'screenConstant' | 'power'
  })(),
  setZoomStrokeScaleMode2d: (v: 'zoomScaled' | 'screenConstant' | 'power') => {
    const next = v === 'screenConstant' || v === 'power' ? v : 'zoomScaled'
    writeLsString(LS_KEYS.zoomStrokeScaleMode2d, next)
    set({ zoomStrokeScaleMode2d: next })
  },
  zoomStrokeScaleExponent2d: clampFloat(lsFloat(LS_KEYS.zoomStrokeScaleExponent2d, 1, { min: 0.05, max: 4 }), 1, { min: 0.05, max: 4 }),
  setZoomStrokeScaleExponent2d: (v: number) => set({ zoomStrokeScaleExponent2d: lsSetFloat(LS_KEYS.zoomStrokeScaleExponent2d, v, { min: 0.05, max: 4 }) }),
  zoomStrokeScaleClampMin2d: clampFloat(lsFloat(LS_KEYS.zoomStrokeScaleClampMin2d, 0.000001, { min: 0.000001, max: 1000 }), 0.000001, { min: 0.000001, max: 1000 }),
  setZoomStrokeScaleClampMin2d: (v: number) => set({ zoomStrokeScaleClampMin2d: lsSetFloat(LS_KEYS.zoomStrokeScaleClampMin2d, v, { min: 0.000001, max: 1000 }) }),
  zoomStrokeScaleClampMax2d: clampFloat(lsFloat(LS_KEYS.zoomStrokeScaleClampMax2d, 1000, { min: 0.000001, max: 1000 }), 1000, { min: 0.000001, max: 1000 }),
  setZoomStrokeScaleClampMax2d: (v: number) => set({ zoomStrokeScaleClampMax2d: lsSetFloat(LS_KEYS.zoomStrokeScaleClampMax2d, v, { min: 0.000001, max: 1000 }) }),

  threeCameraAutoClip: lsBool(LS_KEYS.threeCameraAutoClip, true),
  setThreeCameraAutoClip: (v: boolean) => set({ threeCameraAutoClip: lsSetBool(LS_KEYS.threeCameraAutoClip, v) }),
  threeCameraAutoClipNearFactor: clampFloat(lsFloat(LS_KEYS.threeCameraAutoClipNearFactor, 0.0001, { min: 0.000001, max: 0.1 }), 0.0001, { min: 0.000001, max: 0.1 }),
  setThreeCameraAutoClipNearFactor: (v: number) => set({ threeCameraAutoClipNearFactor: lsSetFloat(LS_KEYS.threeCameraAutoClipNearFactor, v, { min: 0.000001, max: 0.1 }) }),
  threeCameraAutoClipFarFactor: clampFloat(lsFloat(LS_KEYS.threeCameraAutoClipFarFactor, 200, { min: 10, max: 1000000 }), 200, { min: 10, max: 1000000 }),
  setThreeCameraAutoClipFarFactor: (v: number) => set({ threeCameraAutoClipFarFactor: lsSetFloat(LS_KEYS.threeCameraAutoClipFarFactor, v, { min: 10, max: 1000000 }) }),

  threeIframeOverlaySizeScaleFactor: clampFloat(lsFloat(LS_KEYS.threeIframeOverlaySizeScaleFactor, 260, { min: 1, max: 20000 }), 260, { min: 1, max: 20000 }),
  setThreeIframeOverlaySizeScaleFactor: (v: number) => set({ threeIframeOverlaySizeScaleFactor: lsSetFloat(LS_KEYS.threeIframeOverlaySizeScaleFactor, v, { min: 1, max: 20000 }) }),

  threeEdgeRenderer: (() => {
    const raw = readLsString(LS_KEYS.threeEdgeRenderer, 'mesh')
    const next = raw === 'shaderLine' || raw === 'tubeBridge' ? raw : 'mesh'
    return next as 'mesh' | 'shaderLine' | 'tubeBridge'
  })(),
  setThreeEdgeRenderer: (v: 'mesh' | 'shaderLine' | 'tubeBridge') => {
    const next = v === 'shaderLine' || v === 'tubeBridge' ? v : 'mesh'
    writeLsString(LS_KEYS.threeEdgeRenderer, next)
    set({ threeEdgeRenderer: next })
  },
  threeShaderLineWidthPx: clampFloat(lsFloat(LS_KEYS.threeShaderLineWidthPx, 2, { min: 0.5, max: 20 }), 2, { min: 0.5, max: 20 }),
  setThreeShaderLineWidthPx: (v: number) => set({ threeShaderLineWidthPx: lsSetFloat(LS_KEYS.threeShaderLineWidthPx, v, { min: 0.5, max: 20 }) }),
  }
}
