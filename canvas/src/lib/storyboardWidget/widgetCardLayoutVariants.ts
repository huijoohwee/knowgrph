import {
  FLOW_TEXT_GENERATION_NODE_LABEL,
} from '@/lib/config.storyboard-widget'

export const WIDGET_CARD_TYPE_ZERO_LAYOUT_ID = 'widget-card-type-0' as const
export const PROBE_TREE_TYPE_ONE_LAYOUT_ID = 'probe-tree-type-1' as const

export type WidgetCardLayoutVariantId =
  | typeof WIDGET_CARD_TYPE_ZERO_LAYOUT_ID
  | typeof PROBE_TREE_TYPE_ONE_LAYOUT_ID

export function readWidgetCardLayoutVariantId(value: unknown): WidgetCardLayoutVariantId | null {
  const id = String(value || '').trim()
  if (id === WIDGET_CARD_TYPE_ZERO_LAYOUT_ID || id === PROBE_TREE_TYPE_ONE_LAYOUT_ID) return id
  return null
}

export function buildWidgetCardLayoutSeed(variantId: unknown): {
  label: string
  properties: Record<string, unknown>
} | null {
  const id = readWidgetCardLayoutVariantId(variantId)
  if (!id) return null
  if (id === PROBE_TREE_TYPE_ONE_LAYOUT_ID) {
    return {
      label: 'Probe-Tree Card',
      properties: {
        title: 'Probe-Tree Card',
        cardTypeLabel: 'Probe-Tree Card',
        typeLabel: 'Probe-Tree Card',
        lane: 'Probe-Tree',
        prompt: '/knowgrph.probe-tree',
        summary: '',
        output: '',
        tags: ['probe-tree'],
      },
    }
  }
  return {
    label: FLOW_TEXT_GENERATION_NODE_LABEL,
    properties: {
      title: FLOW_TEXT_GENERATION_NODE_LABEL,
      output: '',
    },
  }
}
