import type { GraphNode, JSONValue } from '@/lib/graph/types'

export const GRAPH_NODE_CARD_TITLE_PROPERTY_KEYS = ['title', 'name', 'heading', 'scene', 'shot'] as const
export const GRAPH_NODE_CARD_SUMMARY_PROPERTY_KEYS = ['summary', 'description', 'caption', 'content', 'text', 'note', 'notes'] as const
export const GRAPH_NODE_CARD_ACTION_PROPERTY_KEYS = ['action', 'direction', 'beats', 'blocking', 'instructions', 'steps', 'workflow', 'task'] as const
export const GRAPH_NODE_CARD_DIALOGUE_PROPERTY_KEYS = ['dialogue', 'voiceover', 'vo', 'quote', 'line', 'speakerLine', 'speaker_line', 'narration', 'narrationText', 'voiceOver'] as const
export const GRAPH_NODE_CARD_PROMPT_PROPERTY_KEYS = ['prompt', 'imagePrompt', 'visualPrompt', 'brief', 'visualBrief', 'visual_brief', 'artDirection'] as const

type GraphNodeProperties = Record<string, JSONValue>

export type GraphNodeCardTextFieldId = 'summary' | 'action' | 'dialogue' | 'prompt'

export type GraphNodeCardTextFieldSpec = {
  id: GraphNodeCardTextFieldId
  label: string
  canonicalKey: string
  aliasKeys: readonly string[]
  placeholder: string
}

export const GRAPH_NODE_CARD_TEXT_FIELDS: readonly GraphNodeCardTextFieldSpec[] = [
  {
    id: 'summary',
    label: 'Summary',
    canonicalKey: 'summary',
    aliasKeys: GRAPH_NODE_CARD_SUMMARY_PROPERTY_KEYS,
    placeholder: 'Add summary',
  },
  {
    id: 'action',
    label: 'Action',
    canonicalKey: 'action',
    aliasKeys: GRAPH_NODE_CARD_ACTION_PROPERTY_KEYS,
    placeholder: 'Add action',
  },
  {
    id: 'dialogue',
    label: 'Dialogue',
    canonicalKey: 'dialogue',
    aliasKeys: GRAPH_NODE_CARD_DIALOGUE_PROPERTY_KEYS,
    placeholder: 'Add dialogue',
  },
  {
    id: 'prompt',
    label: 'Prompt',
    canonicalKey: 'prompt',
    aliasKeys: GRAPH_NODE_CARD_PROMPT_PROPERTY_KEYS,
    placeholder: 'Add prompt',
  },
] as const

const normalizeCardText = (value: unknown): string => {
  if (typeof value === 'string') return value.replace(/\r/g, '').trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim()
  return ''
}

export function readGraphNodeProperties(node: Pick<GraphNode, 'properties'> | null | undefined): Record<string, unknown> {
  const properties = node?.properties
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {}
  return properties as Record<string, unknown>
}

export function readGraphNodeCardTitle(node: Pick<GraphNode, 'id' | 'label' | 'properties'> | null | undefined): string {
  const label = normalizeCardText(node?.label)
  if (label) return label
  const properties = readGraphNodeProperties(node)
  const propertyTitle = readGraphNodeCanonicalTextProperty(properties, GRAPH_NODE_CARD_TITLE_PROPERTY_KEYS)
  if (propertyTitle) return propertyTitle
  return normalizeCardText(node?.id) || 'Untitled'
}

export function readGraphNodeCanonicalTextProperty(
  properties: Record<string, unknown>,
  aliasKeys: readonly string[],
): string {
  for (const key of aliasKeys) {
    const value = properties[key]
    const text = normalizeCardText(value)
    if (text) return text
    if (Array.isArray(value) && value.length > 0) {
      const first = normalizeCardText(value[0])
      if (first) return first
    }
  }
  return ''
}

export function buildGraphNodeCanonicalTextPatch(args: {
  currentProperties: Record<string, unknown>
  aliasKeys: readonly string[]
  canonicalKey: string
  nextValue: string
}): Record<string, unknown> {
  const nextProperties: Record<string, unknown> = { ...args.currentProperties }
  for (const key of args.aliasKeys) delete nextProperties[key]
  const normalizedValue = normalizeCardText(args.nextValue)
  if (normalizedValue) nextProperties[args.canonicalKey] = normalizedValue
  return nextProperties
}
