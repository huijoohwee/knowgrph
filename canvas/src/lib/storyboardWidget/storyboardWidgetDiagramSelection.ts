import {
  normalizeDiagramSelectionText,
  readDiagramSelectionLabels,
  resolveDiagramRowKey,
  splitDiagramSelectionTokens,
  type DiagramSelectionRow,
} from '@/lib/diagram/diagramRowSelection'
import type { StoryboardWidgetPortRow } from '@/lib/storyboardWidget/storyboardWidgetPortRows'

export type StoryboardWidgetDiagramSelectionBridge = {
  diagramRowKeyToPortRowKey: Map<string, string>
  portRowKeyToDiagramRowKey: Map<string, string>
}

const MIN_FLOW_DIAGRAM_SELECTION_SCORE = 4
const VIDEO_AGENT_TIMELINE_AFFINITY_SCORE = 96

const VIDEO_AGENT_STAGE_TASK_IDS = new Set([
  'video_agent_source_video',
  'video_agent_frame_by_frame_boxe',
  'video_agent_source_audio',
  'ingest',
  'parse',
  'search',
  'edit',
  'compile',
  'generate',
  'stream',
])

const VIDEO_AGENT_SOURCE_STAGE_TASK_IDS = new Set([
  'video_agent_source_video',
  'video_agent_frame_by_frame_boxe',
  'video_agent_source_audio',
  'ingest',
  'parse',
  'search',
  'edit',
  'compile',
  'generate',
])

const FLOW_DIAGRAM_SELECTION_STOP_TOKENS = new Set([
  'branch',
  'checkout',
  'commit',
  'edge',
  'edges',
  'field',
  'fields',
  'input',
  'inputs',
  'line',
  'merge',
  'node',
  'output',
  'outputs',
  'panel',
  'port',
  'ports',
  'row',
  'rows',
  'section',
  'tag',
  'title',
  'type',
  'value',
  'values',
])

const expandComparableText = (value: unknown): string => {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
}

const normalizeToken = (token: string): string => {
  const lower = token.toLowerCase()
  if (lower.length > 4 && lower.endsWith('s')) return lower.slice(0, -1)
  return lower
}

const normalizeComparableKey = (value: unknown): string => {
  return normalizeDiagramSelectionText(value).replace(/\s+/g, '')
}

const pushComparableTokens = (out: Set<string>, value: unknown): void => {
  const expanded = expandComparableText(value)
  const variants = [expanded, expanded.replace(/[_-]+/g, ' ')]
  for (const variant of variants) {
    for (const token of splitDiagramSelectionTokens(variant)) {
      const normalized = normalizeToken(token)
      if (!normalized || FLOW_DIAGRAM_SELECTION_STOP_TOKENS.has(normalized)) continue
      out.add(normalized)
    }
  }
}

const readComparableTokens = (values: ReadonlyArray<unknown>): Set<string> => {
  const out = new Set<string>()
  for (const value of values) pushComparableTokens(out, value)
  return out
}

const countSharedTokens = (left: Set<string>, right: Set<string>): number => {
  let count = 0
  left.forEach(token => {
    if (right.has(token)) {
      count += 1
      return
    }
    const hasRelatedToken = Array.from(right).some(candidate => (
      token.length >= 5
      && candidate.length >= 5
      && (token.startsWith(candidate) || candidate.startsWith(token))
    ))
    if (hasRelatedToken) count += 1
  })
  return count
}

const readDiagramLabels = (row: DiagramSelectionRow): string[] => {
  const labels = readDiagramSelectionLabels(row)
  return labels.length ? labels : [row.label, row.raw].map(value => String(value || '').trim()).filter(Boolean)
}

const readPrimaryDiagramLabels = (row: DiagramSelectionRow): string[] => {
  return [row.label, row.raw].map(value => String(value || '').trim()).filter(Boolean)
}

const readDiagramComparableText = (row: DiagramSelectionRow): string => {
  return readDiagramLabels(row).join(' ')
}

const readMermaidTaskId = (row: DiagramSelectionRow): string => {
  const raw = String(row.raw || '')
  const match = raw.match(/:\s*([A-Za-z][A-Za-z0-9_-]*)\s*,/)
  return normalizeToken(match?.[1] || '')
}

const isFlowSelectableDiagramRow = (row: DiagramSelectionRow): boolean => {
  const kind = normalizeDiagramSelectionText(row.kind)
  return kind !== 'title' && kind !== 'section'
}

const isVideoAgentSourceSpecPort = (portRow: StoryboardWidgetPortRow): boolean => {
  const tokens = readComparableTokens([portRow.nodeId, portRow.nodeLabel, portRow.nodeType, portRow.socketType])
  return (
    tokens.has('video')
    && (tokens.has('agent') || tokens.has('html'))
    && (tokens.has('render') || tokens.has('spec') || tokens.has('renderer') || tokens.has('source'))
  )
}

const scoreVideoAgentTimelineAffinity = (diagramRow: DiagramSelectionRow, portRow: StoryboardWidgetPortRow): number => {
  if (normalizeDiagramSelectionText(diagramRow.kind) !== 'task') return 0
  const taskId = readMermaidTaskId(diagramRow)
  const diagramText = normalizeComparableKey(readDiagramComparableText(diagramRow))
  const normalizedPortKey = normalizeComparableKey(portRow.portKey)
  const normalizedSocketType = normalizeComparableKey(portRow.socketType)
  let score = 0

  if (
    normalizedPortKey === 'frameboundingboxes'
    && (/framebox|framebyframe|bbox|boundingbox/.test(diagramText) || taskId.startsWith('frame_box'))
  ) {
    score += VIDEO_AGENT_TIMELINE_AFFINITY_SCORE
    if (normalizedSocketType === 'annotationjson') score += 24
    if (isVideoAgentSourceSpecPort(portRow)) score += 12
  }

  if (!VIDEO_AGENT_STAGE_TASK_IDS.has(taskId)) return score
  if (VIDEO_AGENT_SOURCE_STAGE_TASK_IDS.has(taskId)) {
    if (normalizedPortKey === 'datajson') score += VIDEO_AGENT_TIMELINE_AFFINITY_SCORE
    if (normalizedSocketType === 'htmlvideospec') score += 36
    if (portRow.direction === 'output') score += 12
    if (isVideoAgentSourceSpecPort(portRow)) score += 24
  } else if (taskId === 'stream') {
    if (normalizedPortKey === 'outputsrcdoc' || normalizedPortKey === 'videourl') score += VIDEO_AGENT_TIMELINE_AFFINITY_SCORE
    if (normalizedSocketType === 'htmlvideoartifact' || normalizedSocketType === 'richmediainlinehtml') score += 36
    if (isVideoAgentSourceSpecPort(portRow)) score += 12
  }
  return score
}

const scoreDiagramRowAgainstPortRow = (diagramRow: DiagramSelectionRow, portRow: StoryboardWidgetPortRow): number => {
  if (!isFlowSelectableDiagramRow(diagramRow)) return 0
  const diagramLabels = readDiagramLabels(diagramRow)
  const diagramTokens = readComparableTokens(diagramLabels)
  if (!diagramTokens.size) return 0

  const normalizedPrimaryDiagramLabels = readPrimaryDiagramLabels(diagramRow).map(normalizeDiagramSelectionText).filter(Boolean)
  const nodeLabels = [portRow.nodeLabel, portRow.nodeId, portRow.nodeType]
  const normalizedNodeLabels = nodeLabels.map(normalizeDiagramSelectionText).filter(Boolean)
  const hasExactOrContainedNodeLabel = normalizedPrimaryDiagramLabels.some(diagramLabel => {
    return normalizedNodeLabels.some(nodeLabel => {
      return diagramLabel === nodeLabel || nodeLabel.includes(diagramLabel) || diagramLabel.includes(nodeLabel)
    })
  })

  const normalizedPortKey = normalizeDiagramSelectionText(portRow.portKey)
  const hasExactOrContainedPortKey = normalizedPortKey
    ? normalizedPrimaryDiagramLabels.some(diagramLabel => {
      return diagramLabel === normalizedPortKey || diagramLabel.includes(normalizedPortKey) || normalizedPortKey.includes(diagramLabel)
    })
    : false

  const nodeTokens = readComparableTokens(nodeLabels)
  const portTokens = readComparableTokens([portRow.portKey, portRow.socketType, portRow.direction])
  const sharedNodeTokens = countSharedTokens(diagramTokens, nodeTokens)
  const sharedPortTokens = countSharedTokens(diagramTokens, portTokens)
  let score = sharedNodeTokens * 8 + sharedPortTokens * 3 + scoreVideoAgentTimelineAffinity(diagramRow, portRow)
  if (hasExactOrContainedNodeLabel) score += 32
  if (hasExactOrContainedPortKey) score += 24
  if (portRow.connectedEdgeCount > 0) score += 1
  return score
}

const buildBestFlowPortByDiagramRow = (
  diagramRows: readonly DiagramSelectionRow[],
  flowRows: readonly StoryboardWidgetPortRow[],
): Map<string, string> => {
  const out = new Map<string, string>()
  diagramRows.forEach((diagramRow, index) => {
    const diagramRowKey = resolveDiagramRowKey(diagramRow, index)
    if (!diagramRowKey) return
    let bestScore = 0
    let bestPortRowKey = ''
    for (const flowRow of flowRows) {
      const score = scoreDiagramRowAgainstPortRow(diagramRow, flowRow)
      if (score <= bestScore) continue
      bestScore = score
      bestPortRowKey = flowRow.key
    }
    if (bestScore >= MIN_FLOW_DIAGRAM_SELECTION_SCORE && bestPortRowKey) {
      out.set(diagramRowKey, bestPortRowKey)
    }
  })
  return out
}

const buildBestDiagramRowByFlowPort = (
  diagramRows: readonly DiagramSelectionRow[],
  flowRows: readonly StoryboardWidgetPortRow[],
): Map<string, string> => {
  const out = new Map<string, string>()
  for (const flowRow of flowRows) {
    let bestScore = 0
    let bestDiagramRowKey = ''
    diagramRows.forEach((diagramRow, index) => {
      const score = scoreDiagramRowAgainstPortRow(diagramRow, flowRow)
      if (score <= bestScore) return
      const rowKey = resolveDiagramRowKey(diagramRow, index)
      if (!rowKey) return
      bestScore = score
      bestDiagramRowKey = rowKey
    })
    if (bestScore >= MIN_FLOW_DIAGRAM_SELECTION_SCORE && bestDiagramRowKey) {
      out.set(flowRow.key, bestDiagramRowKey)
    }
  }
  return out
}

export const buildStoryboardWidgetDiagramSelectionBridge = ({
  diagramRows,
  flowRows,
}: {
  diagramRows: readonly DiagramSelectionRow[]
  flowRows: readonly StoryboardWidgetPortRow[]
}): StoryboardWidgetDiagramSelectionBridge => {
  return {
    diagramRowKeyToPortRowKey: buildBestFlowPortByDiagramRow(diagramRows, flowRows),
    portRowKeyToDiagramRowKey: buildBestDiagramRowByFlowPort(diagramRows, flowRows),
  }
}

export const resolveStoryboardWidgetPortRowKeyForDiagramRow = (
  bridge: StoryboardWidgetDiagramSelectionBridge,
  diagramRowKey: string | null | undefined,
): string => bridge.diagramRowKeyToPortRowKey.get(String(diagramRowKey || '').trim()) || ''

export const resolveDiagramRowKeyForStoryboardWidgetPortRow = (
  bridge: StoryboardWidgetDiagramSelectionBridge,
  portRowKey: string | null | undefined,
): string => bridge.portRowKeyToDiagramRowKey.get(String(portRowKey || '').trim()) || ''
