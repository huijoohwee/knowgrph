import React from 'react'
import type { TokensCode } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { MermaidDiagram } from '@/features/panels/views/preview-panel/ui/MermaidDiagram'
import type { RenderOpts } from './MarkdownRendererTypes'
import { parseCodeInfoMeta } from './markdownCodeInfo'
import { MarkdownBlockContainer } from './MarkdownBlockContainer'

type MarkdownCodeBlockProps = {
  token: TokenWithLines
  highlightClass: string
  opts: RenderOpts
  wrapClass: string
  highlightStyle?: React.CSSProperties
  fragmentStep?: number
}

export const MarkdownCodeBlock = React.memo(function MarkdownCodeBlock({
  token: t,
  highlightClass,
  opts,
  wrapClass,
  highlightStyle,
  fragmentStep,
}: MarkdownCodeBlockProps) {
  const c = t as unknown as TokensCode
  const meta = parseCodeInfoMeta(c)
  const lang = String(meta.lang || '').trim().toLowerCase()
  
  if (lang === 'mermaid' || lang === 'mmd') {
    return (
      <MermaidDiagram
        code={c.text}
        highlightClass={highlightClass}
        frontmatterConfig={opts.mermaidFrontmatterConfig}
        rootThemeMode={opts.rootThemeMode}
        overlayScope={opts.previewOverlayScope}
        overlayPortalTarget={opts.previewOverlayPortalTarget}
      />
    )
  }

  const lines = String(c.text || '').split('\n')
  const stepIndex = fragmentStep && fragmentStep > 0 ? fragmentStep - 1 : 0
  let activeRanges = meta.highlightRanges
  if (opts.markdownPresentationMode && meta.steps.length > 0) {
    const idx = Math.min(Math.max(0, stepIndex), meta.steps.length - 1)
    activeRanges = meta.steps[idx].ranges
  }
  const isHighlighted = (lineNumber: number): boolean => {
    if (!activeRanges.length) return false
    for (const r of activeRanges) {
      if (lineNumber >= r.start && lineNumber <= r.end) return true
    }
    return false
  }

  const containerClassName = [
    'mt-3 mb-3 p-3 rounded border border-gray-200 bg-gray-50 overflow-auto',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <MarkdownBlockContainer
      as="pre"
      className={containerClassName}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={t.startLine}
      endLine={t.endLine}
    >
      <code className={[opts.uiPanelMonospaceTextClass, wrapClass].filter(Boolean).join(' ')}>
        {lines.map((line, idx) => {
          const lineNumber = idx + 1
          const highlighted = isHighlighted(lineNumber)
          const lineStyle: React.CSSProperties | undefined = highlighted
            ? {
                backgroundColor: 'rgba(148, 163, 184, 0.35)',
              }
            : undefined
          return (
            <React.Fragment key={idx}>
              {meta.showLineNumbers && (
                <span className="select-none mr-2 text-xs text-gray-400">{String(lineNumber)}</span>
              )}
              <span style={lineStyle}>{line || ' '}</span>
              {idx < lines.length - 1 ? '\n' : null}
            </React.Fragment>
          )
        })}
      </code>
    </MarkdownBlockContainer>
  )
})
