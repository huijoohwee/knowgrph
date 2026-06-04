import React from 'react'
import PlainMermaidDiagram from '@/features/markdown/ui/PlainMermaidDiagram'
import { formatTimestamp } from '@/features/panels/utils/time'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  buildDocumentVersionGitGraphRows,
  buildDocumentVersionPathSummaries,
  buildDocumentVersionReviewModel,
  buildDocumentVersionsGitGraphCode,
  normalizeDocumentVersionPath,
  type DocumentVersionEntry,
  type DocumentVersionGitGraphRow,
} from './documentVersioning'
import { useDocumentVersionRecords } from './useDocumentVersions'

const clampPercent = (value: number): number => Math.max(0, Math.min(100, value))

const resolveGitGraphNodePositionPercent = (index: number, total: number): number => {
  if (total <= 1) return 50
  const start = total <= 4 ? 28 : 22
  const step = total <= 4 ? 12 : Math.max(6, Math.min(11, 58 / Math.max(1, total - 1)))
  return clampPercent(start + index * step)
}

const resolveGitGraphPointerIndex = (ratio: number, total: number): number => {
  if (total <= 1) return 0
  const pointerPercent = clampPercent(ratio * 100)
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < total; index += 1) {
    const distance = Math.abs(pointerPercent - resolveGitGraphNodePositionPercent(index, total))
    if (distance >= bestDistance) continue
    bestDistance = distance
    bestIndex = index
  }
  return bestIndex
}

const formatGitGraphRowLabel = (row: DocumentVersionGitGraphRow): string => {
  const sourceLabel = String(row.entry.label || row.entry.source || 'Saved').trim()
  return sourceLabel ? `v${row.versionNumber} ${sourceLabel}` : `v${row.versionNumber}`
}

export function DocumentVersionGitGraphPanel({
  activePath,
  className = '',
  compact = false,
  emptyLabel = 'No document versions.',
  fallbackToLatest = true,
  themeMode,
}: {
  activePath?: string | null
  className?: string
  compact?: boolean
  emptyLabel?: string
  fallbackToLatest?: boolean
  themeMode: 'light' | 'dark'
}) {
  const [selectedVersionId, setSelectedVersionId] = React.useState<string | null>(null)
  const documentVersionSnapshot = useDocumentVersionRecords()
  const summaries = React.useMemo(
    () => buildDocumentVersionPathSummaries(documentVersionSnapshot.entries),
    [documentVersionSnapshot.entries],
  )
  const normalizedActivePath = React.useMemo(() => normalizeDocumentVersionPath(activePath), [activePath])
  const selectedPath = React.useMemo(() => {
    if (normalizedActivePath && summaries.some(row => row.path === normalizedActivePath)) return normalizedActivePath
    return fallbackToLatest ? summaries[0]?.path || '' : normalizedActivePath
  }, [fallbackToLatest, normalizedActivePath, summaries])
  const selectedVersions = React.useMemo(
    () => documentVersionSnapshot.entries
      .filter((entry): entry is DocumentVersionEntry => !!entry && entry.path === selectedPath)
      .sort((a, b) => a.timestamp - b.timestamp),
    [documentVersionSnapshot.entries, selectedPath],
  )
  const selectedSummary = summaries.find(row => row.path === selectedPath) || null
  const gitGraphCode = React.useMemo(() => buildDocumentVersionsGitGraphCode(selectedVersions), [selectedVersions])
  const gitGraphRows = React.useMemo(() => buildDocumentVersionGitGraphRows(selectedVersions), [selectedVersions])

  React.useEffect(() => {
    setSelectedVersionId(current => {
      if (current && selectedVersions.some(entry => entry.id === current)) return current
      return selectedVersions[selectedVersions.length - 1]?.id || null
    })
  }, [selectedVersions])

  const selectedVersionIndex = React.useMemo(() => {
    const index = selectedVersions.findIndex(entry => entry.id === selectedVersionId)
    return index >= 0 ? index : selectedVersions.length - 1
  }, [selectedVersionId, selectedVersions])
  const selectedVersion = selectedVersionIndex >= 0 ? selectedVersions[selectedVersionIndex] || null : null
  const selectedPreviousVersion = selectedVersionIndex > 0 ? selectedVersions[selectedVersionIndex - 1] || null : null
  const selectedReview = React.useMemo(
    () => buildDocumentVersionReviewModel(selectedPreviousVersion, selectedVersion),
    [selectedPreviousVersion, selectedVersion],
  )
  const selectedRow = React.useMemo(() => {
    if (!selectedVersion) return null
    return gitGraphRows.find(row => row.entry.id === selectedVersion.id) || null
  }, [gitGraphRows, selectedVersion])
  const selectedPatchText = selectedReview?.diff.patch || 'No text changes.'

  const handleGraphSurfaceClick = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!gitGraphRows.length) return
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('[data-kg-document-version-gitgraph-version-node]')) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !Number.isFinite(rect.width)) return
    const index = resolveGitGraphPointerIndex((event.clientX - rect.left) / rect.width, gitGraphRows.length)
    const entry = gitGraphRows[index]?.entry || null
    if (entry) setSelectedVersionId(entry.id)
  }, [gitGraphRows])

  const handleVersionNodeClick = React.useCallback((
    event: React.MouseEvent<HTMLButtonElement>,
    row: DocumentVersionGitGraphRow,
  ) => {
    event.stopPropagation()
    setSelectedVersionId(row.entry.id)
  }, [])

  if (!selectedVersions.length || !selectedSummary) {
    return (
      <section
        className={`rounded border px-3 py-2 text-xs ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.text.tertiary} ${className}`.trim()}
        data-kg-document-version-gitgraph-panel="1"
        data-kg-document-version-gitgraph-empty="1"
      >
        {emptyLabel}
      </section>
    )
  }

  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded border ${UI_THEME_TOKENS.panel.border} ${className}`.trim()}
      data-kg-document-version-gitgraph-panel="1"
      data-kg-document-version-gitgraph-path={selectedPath}
      data-kg-document-version-gitgraph-selected-version={selectedVersion?.id || ''}
    >
      <header className={`flex min-w-0 flex-wrap items-center gap-2 border-b px-3 py-1.5 text-xs ${UI_THEME_TOKENS.panel.divider}`}>
        <span className={`font-medium ${UI_THEME_TOKENS.text.primary}`}>GitGraph</span>
        <span className={`min-w-0 truncate ${UI_THEME_TOKENS.text.secondary}`} title={selectedPath}>{selectedPath}</span>
        <span className={UI_THEME_TOKENS.text.tertiary}>{`v${selectedSummary.count}`}</span>
        <span className={UI_THEME_TOKENS.text.tertiary}>{formatTimestamp(selectedSummary.latest.timestamp)}</span>
      </header>
      <section
        className={compact ? 'max-h-32 min-h-[4rem] shrink-0 overflow-auto' : 'max-h-56 min-h-[5rem] shrink-0 overflow-auto'}
        data-kg-document-version-gitgraph-viewport="1"
      >
        <section
          className="relative min-h-[4rem]"
          role="group"
          aria-label="Document version GitGraph"
          onClick={handleGraphSurfaceClick}
          data-kg-document-version-gitgraph-surface="1"
        >
          <PlainMermaidDiagram
            code={gitGraphCode}
            rootThemeMode={themeMode}
          />
          <section className="pointer-events-none absolute inset-0" aria-label="Document version GitGraph version selectors">
            {gitGraphRows.map((row, index) => {
              const selected = row.entry.id === selectedVersion?.id
              return (
                <button
                  key={row.entry.id}
                  type="button"
                  className={[
                    'pointer-events-auto absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border transition',
                    selected
                      ? 'border-blue-600 bg-blue-500/20 shadow-[0_0_0_3px_rgba(59,130,246,0.18)]'
                      : 'border-transparent bg-transparent hover:border-blue-500/70 hover:bg-blue-500/10',
                  ].join(' ')}
                  style={{
                    left: `${resolveGitGraphNodePositionPercent(index, gitGraphRows.length)}%`,
                    top: compact ? '44%' : '48%',
                  }}
                  title={`Show changes for ${formatGitGraphRowLabel(row)}`}
                  aria-label={`Show changes for ${formatGitGraphRowLabel(row)}`}
                  aria-pressed={selected}
                  onClick={event => handleVersionNodeClick(event, row)}
                  data-kg-document-version-gitgraph-version-node={row.entry.id}
                  data-kg-document-version-gitgraph-version-graph-id={row.graphId}
                  data-kg-document-version-gitgraph-version-index={String(index)}
                  data-kg-document-version-gitgraph-version-selected={selected ? 'true' : 'false'}
                >
                  <span className="sr-only">{formatGitGraphRowLabel(row)}</span>
                </button>
              )
            })}
          </section>
        </section>
      </section>
      {selectedReview && selectedVersion ? (
        <section
          className={`min-h-0 overflow-auto border-t ${UI_THEME_TOKENS.panel.divider}`}
          data-kg-document-version-gitgraph-selected-review="1"
          data-kg-document-version-gitgraph-selected-review-version={selectedVersion.id}
        >
          <header className={`sticky top-0 z-10 flex min-w-0 flex-wrap items-center gap-2 px-3 py-1.5 text-xs ${UI_THEME_TOKENS.panel.bg}`}>
            <span className={`font-medium ${UI_THEME_TOKENS.text.primary}`}>
              {selectedRow ? `v${selectedRow.versionNumber}` : 'Selected'}
            </span>
            <span className={selectedReview.diff.changed ? 'text-emerald-700 dark:text-emerald-300' : UI_THEME_TOKENS.text.tertiary}>
              {selectedReview.summary}
            </span>
            <span className={`min-w-0 truncate ${UI_THEME_TOKENS.text.secondary}`} title={selectedVersion.label}>
              {selectedVersion.label}
            </span>
            <span className={UI_THEME_TOKENS.text.tertiary}>{formatTimestamp(selectedVersion.timestamp)}</span>
          </header>
          <pre className={`whitespace-pre-wrap break-words px-3 pb-2 font-mono text-[11px] leading-4 ${UI_THEME_TOKENS.text.primary}`}>
            {selectedPatchText}
          </pre>
        </section>
      ) : null}
    </section>
  )
}
