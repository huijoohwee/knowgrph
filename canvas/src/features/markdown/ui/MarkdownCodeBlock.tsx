import React, { useMemo } from 'react'
import type { TokensCode } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { MermaidDiagram } from '@/features/panels/views/preview-panel/ui/MermaidDiagram'
import type { RenderOpts } from './MarkdownRendererTypes'
import { parseCodeInfoMeta } from './markdownCodeInfo'
import { MarkdownBlockContainer } from './MarkdownBlockContainer'
import hljs from 'highlight.js'

const HLJS_STYLE_ID = 'kg-hljs-theme'
const HLJS_THEME_CSS = `
.hljs{color:#0f172a}
.hljs-comment,.hljs-quote{color:#64748b;font-style:italic}
.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-title,.hljs-section{color:#2563eb}
.hljs-string,.hljs-attribute,.hljs-symbol,.hljs-bullet{color:#16a34a}
.hljs-number,.hljs-meta,.hljs-built_in{color:#b45309}
.hljs-function,.hljs-params{color:#7c3aed}
.hljs-addition{color:#16a34a;background-color:#f0fdf4}
.hljs-deletion{color:#dc2626;background-color:#fef2f2}
`

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
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById(HLJS_STYLE_ID)) return
    const styleEl = document.createElement('style')
    styleEl.id = HLJS_STYLE_ID
    styleEl.textContent = HLJS_THEME_CSS
    document.head.appendChild(styleEl)
  }, [])

  const c = t as unknown as TokensCode
  const meta = parseCodeInfoMeta(c)
  const lang = String(meta.lang || '').trim().toLowerCase()

  const highlightedCode = useMemo(() => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(c.text, { language: lang }).value
      } catch {
        return hljs.highlightAuto(c.text).value
      }
    }
    return hljs.highlightAuto(c.text).value
  }, [c.text, lang])
  
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
    'mt-4 mb-4 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shadow-sm text-sm relative group',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <MarkdownBlockContainer
      as="div"
      className={containerClassName}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={t.startLine}
      endLine={t.endLine}
    >
       <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {lines.map((_, idx) => {
          const lineNumber = idx + 1
          const highlighted = isHighlighted(lineNumber)
          if (!highlighted) return <div key={idx} className="h-[1.5em]" />
          return (
            <div
              key={idx}
              className="h-[1.5em] bg-blue-100/50 w-full"
            />
          )
        })}
      </div>

      <div className="relative flex overflow-auto p-4">
        {meta.showLineNumbers && (
          <div className="select-none mr-4 text-xs text-gray-400 text-right flex flex-col" style={{ minWidth: '1.5em' }}>
            {lines.map((_, idx) => (
              <span key={idx} className="h-[1.5em] leading-[1.5em]">{idx + 1}</span>
            ))}
          </div>
        )}

        <pre className={`m-0 p-0 bg-transparent ${wrapClass} flex-1`}>
          <code
            className={`hljs language-${lang} !bg-transparent !p-0 block leading-[1.5em]`}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </pre>
      </div>
      
      {lang && (
        <div className="absolute top-2 right-2 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity select-none uppercase font-mono">
          {lang}
        </div>
      )}
    </MarkdownBlockContainer>
  )
})
