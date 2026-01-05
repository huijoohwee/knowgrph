import { buildNumericTooltip } from '@/lib/config'
import {
  COLLISION_RADIUS_DEFAULT,
  COLLISION_RADIUS_INTERVAL,
  COLLISION_RADIUS_MAX,
  COLLISION_RADIUS_MIN,
} from '@/features/panels/utils/orchestratorTraversal'

export const COLLISION_RADIUS_TOOLTIP = buildNumericTooltip({
  defaultValue: COLLISION_RADIUS_DEFAULT,
  min: COLLISION_RADIUS_MIN,
  max: COLLISION_RADIUS_MAX,
  interval: COLLISION_RADIUS_INTERVAL,
  impact:
    'Higher values push nodes apart in dense regions; lower values keep AI-KG layers tighter around traversal paths.',
})

export const LAYER1_OPACITY_TOOLTIP = buildNumericTooltip({
  defaultValue: 1,
  min: 0.2,
  max: 1,
  interval: 0.05,
  impact:
    'Higher values make Layer 1 more opaque in the foreground band; lower values fade top-layer concepts during traversal replays.',
})

export const LAYER2_OPACITY_TOOLTIP = buildNumericTooltip({
  defaultValue: 0.9,
  min: 0.2,
  max: 1,
  interval: 0.05,
  impact:
    'Higher values make Layer 2 more opaque in the mid band; lower values fade supporting context behind traversal highlights.',
})

export const LAYER3_OPACITY_TOOLTIP = buildNumericTooltip({
  defaultValue: 0.8,
  min: 0.2,
  max: 1,
  interval: 0.05,
  impact:
    'Higher values make Layer 3 more opaque in the background band; lower values push traversal paths forward against a lighter backdrop.',
})

export const CHARGE_STRENGTH_DEFAULT = 520
export const CHARGE_STRENGTH_MIN = 200
export const CHARGE_STRENGTH_MAX = 900
export const CHARGE_STRENGTH_INTERVAL = 20

export const CHARGE_STRENGTH_TOOLTIP = buildNumericTooltip({
  defaultValue: CHARGE_STRENGTH_DEFAULT,
  min: CHARGE_STRENGTH_MIN,
  max: CHARGE_STRENGTH_MAX,
  interval: CHARGE_STRENGTH_INTERVAL,
  impact:
    'Higher values increase node repulsion and spread AI-KG clusters apart; lower values keep clusters denser around traversal focus points.',
})

export const SEMANTIC_TOPK_EDGES_TOOLTIP = buildNumericTooltip({
  defaultValue: 3,
  min: 0,
  max: 32,
  interval: 1,
  impact:
    'Higher values favor recall (more neighbors); lower values favor precision (sparser graph).',
})

export const SEMANTIC_MIN_SIMILARITY_TOOLTIP = buildNumericTooltip({
  defaultValue: 'metric-specific default (≈0.2 cosine, ≈0.15 pmi)',
  min: 0,
  max: 1,
  interval: 0.01,
  impact: 'Higher values favor precision (drop weak links); lower values favor recall.',
})
