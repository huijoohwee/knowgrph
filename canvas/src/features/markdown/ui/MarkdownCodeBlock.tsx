import React, { useMemo, useState } from 'react'
import type { TokensCode } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { MermaidDiagram } from '@/features/panels/views/preview-panel/ui/MermaidDiagram'
import type { RenderOpts } from './MarkdownRendererTypes'
import { parseCodeInfoMeta } from './markdownCodeInfo'
import { MarkdownBlockContainer } from './MarkdownBlockContainer'
import hljs from 'highlight.js'
import { Check, Copy } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

const HLJS_STYLE_ID = 'kg-hljs-theme'
const HLJS_THEME_CSS = `
/* Light Theme (GitHub-like) */
.hljs { color: #24292f; background: transparent; }
.hljs-comment, .hljs-quote { color: #6e7781; font-style: italic; }
.hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-title, .hljs-section { color: #cf222e; }
.hljs-string, .hljs-attribute, .hljs-symbol, .hljs-bullet { color: #0a3069; }
.hljs-number, .hljs-meta, .hljs-built_in { color: #953800; }
.hljs-function, .hljs-params { color: #8250df; }
.hljs-addition { color: #1a7f37; background-color: #dafbe1; }
.hljs-deletion { color: #cf222e; background-color: #ffebe9; }

/* Dark Theme (GitHub Dark-like) */
.dark .hljs { color: #c9d1d9; background: transparent; }
.dark .hljs-comment, .dark .hljs-quote { color: #8b949e; }
.dark .hljs-keyword, .dark .hljs-selector-tag, .dark .hljs-literal, .dark .hljs-title, .dark .hljs-section { color: #ff7b72; }
.dark .hljs-string, .dark .hljs-attribute, .dark .hljs-symbol, .dark .hljs-bullet { color: #a5d6ff; }
.dark .hljs-number, .dark .hljs-meta, .dark .hljs-built_in { color: #d2a8ff; }
.dark .hljs-function, .dark .hljs-params { color: #d2a8ff; }
.dark .hljs-addition { color: #3fb950; background-color: rgba(46, 160, 67, 0.15); }
.dark .hljs-deletion { color: #f85149; background-color: rgba(218, 54, 51, 0.15); }
`

type MarkdownCodeBlockProps = {
  token: TokenWithLines
  highlightClass: string
  opts: RenderOpts
  wrapClass: string
  highlightStyle?: React.CSSProperties
  fragmentStep?: number
}

function ClipboardCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="zeroclipboard-container absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        aria-label="Copy"
        className={`ClipboardButton btn btn-invisible m-2 p-1.5 flex items-center justify-center rounded-md border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer`}
        onClick={handleCopy}
        type="button"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className={`w-3.5 h-3.5 ${UI_THEME_TOKENS.text.secondary}`} />
        )}
      </button>
    </div>
  )
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
    `mt-4 mb-4 rounded-lg border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} overflow-hidden shadow-sm text-sm relative group highlight highlight-source-${lang} notranslate position-relative overflow-auto`,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <MarkdownBlockContainer
      as="figure"
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
              className="h-[1.5em] bg-blue-100/50 dark:bg-blue-900/20 w-full"
            />
          )
        })}
      </div>

      <div className="relative flex overflow-auto p-4">
        {meta.showLineNumbers && (
          <div className="select-none mr-4 text-xs text-gray-400 dark:text-gray-600 text-right flex flex-col" style={{ minWidth: '1.5em' }}>
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
      
      <ClipboardCopyButton text={c.text} />
      
      {lang && (
        <div className="absolute top-2 right-10 text-xs text-gray-400 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity select-none uppercase font-mono">
          {lang}
        </div>
      )}
    </MarkdownBlockContainer>
  )
})
