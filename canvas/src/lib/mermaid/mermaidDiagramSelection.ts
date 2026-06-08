import {
  normalizeDiagramSelectionText,
  readDiagramSelectionLabels,
  resolveDiagramRowKey,
  type DiagramSelectionRow,
} from '@/lib/diagram/diagramRowSelection'
import type { InteractiveMermaidSelectionRow } from '@/lib/diagram/InteractiveMermaidDiagram'

const MERMAID_DIRECT_SELECTION_IGNORED_LABELS = new Set([
  'active',
  'after',
  'axisformat',
  'branch',
  'checkout',
  'cherry',
  'commit',
  'config',
  'crit',
  'dateformat',
  'done',
  'excludes',
  'id',
  'includes',
  'merge',
  'milestone',
  'reset',
  'section',
  'tag',
  'task',
  'tickinterval',
  'title',
  'todaymarker',
  'type',
  'until',
  'weekday',
])

export const normalizeMermaidDiagramInteractionLabel = (value: string | null | undefined): string => {
  return normalizeDiagramSelectionText(value)
}

export const mermaidDiagramSelectionLabelMatchesRow = (
  label: string,
  row: DiagramSelectionRow,
): boolean => {
  const normalizedLabel = normalizeMermaidDiagramInteractionLabel(label)
  if (!normalizedLabel) return false
  return readDiagramSelectionLabels(row).some(candidate => {
    const normalizedCandidate = normalizeMermaidDiagramInteractionLabel(candidate)
    if (!normalizedCandidate) return false
    return normalizedLabel === normalizedCandidate || normalizedLabel.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedLabel)
  })
}

export const isMermaidDirectSelectionNoiseLabel = (label: string): boolean => {
  const normalized = normalizeMermaidDiagramInteractionLabel(label)
  if (!normalized) return true
  if (MERMAID_DIRECT_SELECTION_IGNORED_LABELS.has(normalized)) return true
  if (/^\d{4}\s+\d{2}\s+\d{2}$/.test(normalized)) return true
  if (/^\d+\s*[dhmsw]$/.test(normalized)) return true
  return false
}

export const readMermaidDirectSelectionLabels = (
  row: DiagramSelectionRow | null | undefined,
): string[] => {
  return readDiagramSelectionLabels(row).filter(label => !isMermaidDirectSelectionNoiseLabel(label))
}

export const buildMermaidInteractiveSelectionRows = (
  rows: readonly DiagramSelectionRow[],
): InteractiveMermaidSelectionRow[] => {
  return rows.map((row, index) => ({
    key: resolveDiagramRowKey(row, index),
    labels: readMermaidDirectSelectionLabels(row),
    kind: row.kind,
    lineNumber: row.lineNumber,
  })).filter(row => row.key && row.labels.length)
}

export const findMermaidDiagramRowKeyForSvgLabel = (
  rows: readonly DiagramSelectionRow[],
  label: string | null | undefined,
): string => {
  const rawLabel = String(label || '').trim()
  if (!rawLabel) return ''
  const selectionRows = buildMermaidInteractiveSelectionRows(rows)
  const directRow = selectionRows.find(row => row.key === rawLabel)
  if (directRow) return directRow.key
  const index = rows.findIndex(row => mermaidDiagramSelectionLabelMatchesRow(rawLabel, row))
  return index >= 0 ? resolveDiagramRowKey(rows[index], index) : ''
}

export const findMermaidDiagramRowForRowKey = (
  rows: readonly DiagramSelectionRow[],
  rowKey: string | null | undefined,
): DiagramSelectionRow | null => {
  const normalized = String(rowKey || '').trim()
  if (!normalized) return null
  const index = rows.findIndex((row, rowIndex) => resolveDiagramRowKey(row, rowIndex) === normalized)
  return index >= 0 ? rows[index] || null : null
}
