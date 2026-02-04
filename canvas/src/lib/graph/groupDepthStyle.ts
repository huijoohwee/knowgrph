export type GroupDepthStyleConfig = {
  enabled?: boolean
  outerMaxBoostSteps?: number
  outerStrokeWidthStepPx?: number
  outerFillOpacityStep?: number
}

export function computeGroupDepthStyle(args: {
  depth: number
  maxDepth: number
  baseStrokeWidthPx: number
  baseFillOpacity: number
  config?: GroupDepthStyleConfig | null
}): { strokeWidthPx: number; fillOpacity: number } {
  const cfg = args.config || {}
  if (cfg.enabled === false) {
    return { strokeWidthPx: args.baseStrokeWidthPx, fillOpacity: args.baseFillOpacity }
  }

  const outerMax =
    typeof cfg.outerMaxBoostSteps === 'number' && Number.isFinite(cfg.outerMaxBoostSteps) ? Math.max(0, Math.floor(cfg.outerMaxBoostSteps)) : 3
  const strokeStep =
    typeof cfg.outerStrokeWidthStepPx === 'number' && Number.isFinite(cfg.outerStrokeWidthStepPx) ? Math.max(0, cfg.outerStrokeWidthStepPx) : 0.55
  const fillStep =
    typeof cfg.outerFillOpacityStep === 'number' && Number.isFinite(cfg.outerFillOpacityStep) ? Math.max(0, cfg.outerFillOpacityStep) : 0.035

  const depth = Number.isFinite(args.depth) ? Math.max(0, Math.floor(args.depth)) : 0
  const maxDepth = Number.isFinite(args.maxDepth) ? Math.max(0, Math.floor(args.maxDepth)) : 0
  const outerBoostSteps = Math.max(0, Math.min(outerMax, maxDepth - depth))

  const strokeWidthPx = Math.max(0, args.baseStrokeWidthPx + outerBoostSteps * strokeStep)
  const fillOpacity = Math.max(0, Math.min(0.35, args.baseFillOpacity + outerBoostSteps * fillStep))
  return { strokeWidthPx, fillOpacity }
}

