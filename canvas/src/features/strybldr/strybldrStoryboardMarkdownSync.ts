import type { GraphNode } from '@/lib/graph/types'
import { buildMermaidGanttWorkflowCode } from '@/lib/mermaid/mermaidDiagramCode'
import type { StrybldrCardOverride, StrybldrStoryboardDocument } from './strybldrTypes'

const cleanText = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim()
const cleanMultilineText = (value: unknown): string => String(value ?? '').replace(/\r\n?/g, '\n').trim()
const STRYBLDR_CARD_OVERRIDE_TEXT_KEYS = ['title', 'type', 'lane', 'summary', 'output', 'action', 'dialogue', 'prompt', 'chatModel', 'outputSrcDoc', 'imageUrl', 'mediaKind', 'mediaUrl', 'renderUrl', 'sourceUrl'] as const
const STRYBLDR_CARD_OVERRIDE_NUMBER_KEYS = ['order'] as const

export const buildStrybldrCardOverridePatchFromGraphNodeChange = (args: { previousNode?: GraphNode | null; nextNode?: GraphNode | null }): Omit<Partial<StrybldrCardOverride>, 'nodeId'> => {
  const previousNode = args.previousNode || null
  const nextNode = args.nextNode || null
  if (!previousNode || !nextNode) return {}
  const patch: Omit<Partial<StrybldrCardOverride>, 'nodeId'> = {}
  const previousLabel = cleanMultilineText(previousNode.label)
  const nextLabel = cleanMultilineText(nextNode.label)
  const previousType = cleanMultilineText(previousNode.type)
  const nextType = cleanMultilineText(nextNode.type)
  const previousProperties = (previousNode.properties || {}) as Record<string, unknown>
  const nextProperties = (nextNode.properties || {}) as Record<string, unknown>
  if (previousLabel !== nextLabel) patch.title = nextLabel
  if (previousType !== nextType) patch.type = nextType
  for (const key of STRYBLDR_CARD_OVERRIDE_TEXT_KEYS) {
    if (key === 'title') {
      const previousTitle = cleanMultilineText(previousProperties.title)
      const nextTitle = cleanMultilineText(nextProperties.title)
      if (previousTitle !== nextTitle && !Object.prototype.hasOwnProperty.call(patch, 'title')) patch.title = nextTitle
      continue
    }
    if (key === 'type') continue
    const previousValue = cleanMultilineText(previousProperties[key])
    const nextValue = cleanMultilineText(nextProperties[key])
    if (previousValue !== nextValue) patch[key] = nextValue
  }
  for (const key of STRYBLDR_CARD_OVERRIDE_NUMBER_KEYS) {
    const previousValue = Number(previousProperties[key])
    const nextValue = Number(nextProperties[key])
    const previousComparable = Number.isFinite(previousValue) ? previousValue : null
    const nextComparable = Number.isFinite(nextValue) ? nextValue : null
    if (previousComparable !== nextComparable) patch[key] = nextComparable
  }
  return patch
}

const readStrybldrWorkflowGanttSteps = (doc: StrybldrStoryboardDocument | null | undefined): Array<{ id: string; label: string }> => {
  if (!doc) return []
  const elements = Array.isArray(doc.elements)
    ? doc.elements.slice().sort((a, b) => {
      const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.MAX_SAFE_INTEGER
      const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.MAX_SAFE_INTEGER
      if (orderA !== orderB) return orderA - orderB
      return cleanText(a.label).localeCompare(cleanText(b.label))
    }).map((element, index) => ({
      id: cleanText(element.id) || cleanText(element.label) || 'strybldr-step-' + (index + 1),
      label: cleanText(element.label) || 'Strybldr step ' + (index + 1),
    })).filter(step => !!step.label)
    : []
  if (elements.length > 0) return elements
  return (doc.workflow?.stages || []).map((stage, index) => ({
    id: cleanText(stage) || 'strybldr-stage-' + (index + 1),
    label: cleanText(stage) || 'Strybldr stage ' + (index + 1),
  })).filter(step => !!step.label)
}

export const buildStrybldrWorkflowGanttCode = (doc: StrybldrStoryboardDocument | null | undefined): string => buildMermaidGanttWorkflowCode({
  idPrefix: 'strybldr',
  title: 'Strybldr Workflow Timeline',
  steps: readStrybldrWorkflowGanttSteps(doc),
})
