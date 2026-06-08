import {
  resolveDiagramRowKey,
  type DiagramSelectionRow,
} from '@/lib/diagram/diagramRowSelection'
import type { MermaidDiagramCodeModel } from '@/lib/mermaid/mermaidDiagramCode'
import type { MermaidGitGraphCommand } from '@/lib/mermaid/mermaidGitGraphEdit'

export const readGitGraphCommandSelectionLabel = (
  command: MermaidGitGraphCommand | null | undefined,
): string => {
  if (!command) return ''
  return command.commitId || command.tag || command.target || command.label || ''
}

export const normalizeGitGraphComparableLabel = (value: string | null | undefined): string => {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

export const readGitGraphCommandSelectionLabelCandidates = (
  command: MermaidGitGraphCommand | null | undefined,
): string[] => {
  if (!command) return []
  const labels: string[] = []
  const seen = new Set<string>()
  const push = (value: string | null | undefined) => {
    const label = String(value || '').replace(/\s+/g, ' ').trim()
    const normalized = normalizeGitGraphComparableLabel(label)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    labels.push(label)
  }
  push(command.commitId)
  push(command.tag)
  push(command.target)
  push(command.label)
  return labels
}

export const findGitGraphCommandForExactLabel = (
  commands: ReadonlyArray<MermaidGitGraphCommand>,
  label: string | null | undefined,
): MermaidGitGraphCommand | null => {
  const normalized = normalizeGitGraphComparableLabel(label)
  if (!normalized) return null
  return commands.find(command => {
    return readGitGraphCommandSelectionLabelCandidates(command).some(value => {
      return normalizeGitGraphComparableLabel(value) === normalized
    })
  }) || null
}

const findDiagramRowIndexByLineIndex = (
  diagramModel: Pick<MermaidDiagramCodeModel, 'rows'> | null | undefined,
  lineIndex: number | null | undefined,
): number => {
  if (typeof lineIndex !== 'number' || !Number.isFinite(lineIndex)) return -1
  return (diagramModel?.rows || []).findIndex(row => row.lineIndex === lineIndex)
}

export const resolveGitGraphCommandRowKey = (
  command: MermaidGitGraphCommand | null | undefined,
  commandIndex = -1,
  diagramModel?: Pick<MermaidDiagramCodeModel, 'rows'> | null,
): string => {
  if (!command) return ''
  const rowIndex = findDiagramRowIndexByLineIndex(diagramModel, command.lineIndex)
  const row = rowIndex >= 0 ? diagramModel?.rows[rowIndex] : null
  return row ? resolveDiagramRowKey(row, rowIndex) : resolveDiagramRowKey(command, commandIndex)
}

export const buildGitGraphCommandRowKeyByLineIndex = (
  diagramModel: Pick<MermaidDiagramCodeModel, 'rows'> | null | undefined,
): Map<number, string> => {
  const out = new Map<number, string>()
  ;(diagramModel?.rows || []).forEach((row, index) => {
    if (typeof row.lineIndex !== 'number' || !Number.isFinite(row.lineIndex)) return
    out.set(row.lineIndex, resolveDiagramRowKey(row, index))
  })
  return out
}

export const findGitGraphCommandForRowKey = (
  commands: ReadonlyArray<MermaidGitGraphCommand>,
  rowKey: string | null | undefined,
  diagramModel?: Pick<MermaidDiagramCodeModel, 'rows'> | null,
): MermaidGitGraphCommand | null => {
  const normalized = String(rowKey || '').trim()
  if (!normalized) return null
  return commands.find((command, index) => {
    return resolveGitGraphCommandRowKey(command, index, diagramModel) === normalized ||
      resolveDiagramRowKey(command as DiagramSelectionRow, index) === normalized
  }) || null
}

export const findGitGraphCommandForLineIndex = (
  commands: ReadonlyArray<MermaidGitGraphCommand>,
  lineIndex: number | null | undefined,
): MermaidGitGraphCommand | null => {
  if (typeof lineIndex !== 'number' || !Number.isFinite(lineIndex)) return null
  return commands.find(command => command.lineIndex === lineIndex) || null
}

export const resolveGitGraphSelectedCommand = ({
  commands,
  diagramModel,
  selectedRowKey,
  selectedLineIndex,
}: {
  commands: ReadonlyArray<MermaidGitGraphCommand>
  diagramModel?: Pick<MermaidDiagramCodeModel, 'rows'> | null
  selectedRowKey?: string | null
  selectedLineIndex?: number | null
}): MermaidGitGraphCommand | null => {
  return findGitGraphCommandForRowKey(commands, selectedRowKey, diagramModel) ||
    findGitGraphCommandForLineIndex(commands, selectedLineIndex)
}
