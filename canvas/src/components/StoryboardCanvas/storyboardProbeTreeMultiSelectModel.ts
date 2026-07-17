import {
  PROBE_TREE_CARD_VARIANTS,
  normalizeProbeTreeSelectionOptions,
} from '@/features/agent-ready/probeTreeContract.mjs'
import { unwrapGraphCellValue } from '@/lib/graph/nodeProperties'
import type { JSONValue } from '@/lib/graph/types'

export type StoryboardProbeTreeMultiSelectModel = {
  options: Array<{ id: string; label: string }>
  allowOther: true
}

export function readStoryboardProbeTreeMultiSelectModel(
  properties: Record<string, JSONValue>,
): StoryboardProbeTreeMultiSelectModel | null {
  const variant = String(unwrapGraphCellValue(properties.probeTreeCardVariant) ?? '').trim()
  const selectionMode = String(unwrapGraphCellValue(properties.selectionMode) ?? '').trim()
  if (variant !== PROBE_TREE_CARD_VARIANTS.boundedMultiSelect || selectionMode !== 'multiple') return null
  if (unwrapGraphCellValue(properties.allowOther) !== true) return null
  const options = normalizeProbeTreeSelectionOptions(unwrapGraphCellValue(properties.selectionOptions))
  return options.length >= 2 ? { options, allowOther: true } : null
}
