import React from 'react'
import type { TokensCode } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { MermaidDiagram } from '@/features/panels/views/preview-panel/ui/MermaidDiagram'
import type { RenderOpts } from './MarkdownRendererTypes'

type MarkdownCodeBlockProps = {
  token: TokenWithLines
  highlightClass: string
  opts: RenderOpts
  wrapClass: string
  highlightStyle?: React.CSSProperties
}

export const MarkdownCodeBlock = React.memo(function MarkdownCodeBlock({
  token: t,
  highlightClass,
  opts,
  wrapClass,
  highlightStyle,
}: MarkdownCodeBlockProps) {
  const c = t as unknown as TokensCode
  const lang = String((c as unknown as { lang?: unknown }).lang || '').trim().toLowerCase()
  
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

  return (
    <pre
      className={[
        'mt-3 mb-3 p-3 rounded border border-gray-200 bg-gray-50 overflow-auto',
        highlightClass,
      ].filter(Boolean).join(' ')}
      style={highlightStyle}
      data-start-line={t.startLine}
      data-end-line={t.endLine || t.startLine}
    >
      <code className={[opts.uiPanelMonospaceTextClass, wrapClass].filter(Boolean).join(' ')}>
        {c.text}
      </code>
    </pre>
  )
})
