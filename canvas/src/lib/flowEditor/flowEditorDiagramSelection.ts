import {
  normalizeDiagramSelectionText,
  readDiagramSelectionLabels,
  resolveDiagramRowKey,
  splitDiagramSelectionTokens,
  type DiagramSelectionRow,
} from '@/lib/diagram/diagramRowSelection'
import type { FlowEditorPortRow } from '@/lib/flowEditor/flowEditorPortRows'

export type FlowEditorDiagramSelectionBridge = {
  diagramRowKeyToPortRowKey: Map<string, string>
  portRowKeyToDiagramRowKey: Map<string, string>
}

const MIN_FLOW_DIAGRAM_SELECTION_SCORE = 4

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
    if (right.has(token)) count += 1
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

const isFlowSelectableDiagramRow = (row: DiagramSelectionRow): boolean => {
  const kind = normalizeDiagramSelectionText(row.kind)
  return kind !== 'title' && kind !== 'section'
}

const scoreDiagramRowAgainstPortRow = (diagramRow: DiagramSelectionRow, portRow: FlowEditorPortRow): number => {
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
  let score = sharedNodeTokens * 8 + sharedPortTokens * 3
  if (hasExactOrContainedNodeLabel) score += 32
  if (hasExactOrContainedPortKey) score += 24
  if (portRow.connectedEdgeCount > 0) score += 1
  return score
}

const buildBestFlowPortByDiagramRow = (
  diagramRows: readonly DiagramSelectionRow[],
  flowRows: readonly FlowEditorPortRow[],
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
  flowRows: readonly FlowEditorPortRow[],
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

export const buildFlowEditorDiagramSelectionBridge = ({
  diagramRows,
  flowRows,
}: {
  diagramRows: readonly DiagramSelectionRow[]
  flowRows: readonly FlowEditorPortRow[]
}): FlowEditorDiagramSelectionBridge => {
  return {
    diagramRowKeyToPortRowKey: buildBestFlowPortByDiagramRow(diagramRows, flowRows),
    portRowKeyToDiagramRowKey: buildBestDiagramRowByFlowPort(diagramRows, flowRows),
  }
}

export const resolveFlowEditorPortRowKeyForDiagramRow = (
  bridge: FlowEditorDiagramSelectionBridge,
  diagramRowKey: string | null | undefined,
): string => bridge.diagramRowKeyToPortRowKey.get(String(diagramRowKey || '').trim()) || ''

export const resolveDiagramRowKeyForFlowEditorPortRow = (
  bridge: FlowEditorDiagramSelectionBridge,
  portRowKey: string | null | undefined,
): string => bridge.portRowKeyToDiagramRowKey.get(String(portRowKey || '').trim()) || ''
