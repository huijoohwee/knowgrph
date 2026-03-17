import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_COPY } from '@/lib/config'
import { computeMarkdownBacklinks } from 'grph-shared/markdown/backlinks'

export type MarkdownBacklinksPanelProps = {
  uiPanelTextFontClass: string
  activeDocumentKey: string | null
  sourceFiles?: Array<{ id: string; name: string; text?: string | null }>
  onSourceFileSelect?: (id: string) => void
}

export function MarkdownBacklinksPanel(props: MarkdownBacklinksPanelProps) {
  const {
    uiPanelTextFontClass,
    activeDocumentKey,
    sourceFiles,
    onSourceFileSelect,
  } = props

  const backlinks = React.useMemo(() => {
    const target = String(activeDocumentKey || '').trim()
    if (!target) return []
    return computeMarkdownBacklinks({
      targetDocKey: target,
      sources: (sourceFiles || []).map(f => ({ docKey: String(f.name || ''), text: f.text })),
    })
  }, [activeDocumentKey, sourceFiles])

  const backlinkByName = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const f of sourceFiles || []) {
      const name = String(f.name || '').trim()
      const id = String(f.id || '').trim()
      if (!name || !id) continue
      map.set(name, { id, name })
    }
    return map
  }, [sourceFiles])

  const hasAny = backlinks.length > 0

  return (
    hasAny ? (
      <nav aria-label={UI_COPY.markdownPreviewBacklinksLabel} className="min-h-0">
        <ul className="flex flex-col" role="list" aria-label={UI_COPY.markdownPreviewBacklinksLabel}>
          {backlinks.map(b => {
              const rowClassName = [
                `border-b ${UI_THEME_TOKENS.panel.divider} last:border-b-0 px-2 py-1`,
                'flex items-center gap-2 min-w-0 overflow-hidden cursor-pointer select-none',
                UI_THEME_TOKENS.table.rowHoverAmber,
              ]
                .filter(Boolean)
                .join(' ')

              const source = backlinkByName.get(b.sourceDocKey)
              const label = source?.name || b.sourceLabel
              const countLabel = String(b.count)

              return (
                <li key={b.sourceDocKey} role="none">
                  <button
                    type="button"
                    className={rowClassName}
                    onClick={() => {
                      if (!source?.id) return
                      onSourceFileSelect?.(source.id)
                    }}
                    title={label}
                  >
                    <span
                      className={[
                        'min-w-0 flex-1 text-[12px] truncate',
                        UI_THEME_TOKENS.text.primary,
                        uiPanelTextFontClass,
                      ].join(' ')}
                    >
                      {label}
                    </span>
                    <span className={`text-[10px] px-1 py-px rounded ${UI_THEME_TOKENS.badge.chip} ${UI_THEME_TOKENS.text.tertiary}`}>
                      {countLabel}
                    </span>
                  </button>
                </li>
              )
          })}
        </ul>
      </nav>
    ) : (
      <p className={[`px-2 py-2 ${UI_THEME_TOKENS.text.tertiary}`, uiPanelTextFontClass, 'text-xs'].join(' ')}>
        {UI_COPY.markdownPreviewBacklinksEmptyStateLabel}
      </p>
    )
  )
}
