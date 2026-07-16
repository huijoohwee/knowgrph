import {
  FLOW_TEXT_GENERATION_NODE_LABEL,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
} from '@/lib/config.storyboard-widget'
import { toStoryboardTitleCase } from '@/components/StoryboardCanvas/storyboardModelScalars'

const STRUCTURAL_NODE_TYPE_RE = /\b(document|root|workspace|group|cluster|section)\b/i
const STORYBOARD_NODE_TYPE_RE = /\b(scene|shot|frame|panel|story|beat|sequence)\b/i

const normalizeIdentityLabel = (value: unknown): string => (
  String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
)

const shouldUseWidgetCardIdentity = (nodeType: string, explicitLabel: string): boolean => (
  nodeType === FLOW_TEXT_GENERATION_NODE_TYPE_ID
  && (!explicitLabel || normalizeIdentityLabel(explicitLabel) === 'textgeneration')
)

export const isStoryboardCardNodeType = (nodeType: string): boolean => STORYBOARD_NODE_TYPE_RE.test(nodeType)
export const isStructuralStoryboardNodeType = (nodeType: string): boolean => STRUCTURAL_NODE_TYPE_RE.test(nodeType)

export function resolveStoryboardCardLaneLabel(nodeType: string, explicitLabel: string, emptyLabel: string): string {
  if (shouldUseWidgetCardIdentity(nodeType, explicitLabel)) return FLOW_TEXT_GENERATION_NODE_LABEL
  if (explicitLabel) return explicitLabel
  if (isStoryboardCardNodeType(nodeType)) return toStoryboardTitleCase(nodeType)
  if (nodeType && !isStructuralStoryboardNodeType(nodeType)) return toStoryboardTitleCase(nodeType)
  return emptyLabel
}

export function resolveStoryboardCardTypeLabel(nodeType: string, explicitLabel: string): string {
  if (shouldUseWidgetCardIdentity(nodeType, explicitLabel)) return FLOW_TEXT_GENERATION_NODE_LABEL
  if (explicitLabel) return explicitLabel
  return nodeType ? toStoryboardTitleCase(nodeType) : 'Node'
}
