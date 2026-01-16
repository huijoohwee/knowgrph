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
import { parseAnnotatedCode, type AnnotatedCodeRow } from './markdownAnnotatedCode'

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
  annotateDisplayMode?: 'inline' | 'beside'
}

function ClipboardCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setCopied(false)
        timerRef.current = null
      }, 2000)
    })
  }

  return (
    <button
      aria-label="Copy code to clipboard"
      className={`btn btn-sm tooltipped tooltipped-nw p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${UI_THEME_TOKENS.text.secondary}`}
      onClick={handleCopy}
      type="button"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  )
}

const HighlightedCode = React.memo(({ code, lang, highlightLines }: { code: string; lang: string; highlightLines: Set<number> | null }) => {
  const highlighted = useMemo(() => {
    let html = ''
    if (lang && hljs.getLanguage(lang)) {
      try {
        html = hljs.highlight(code, { language: lang }).value
      } catch {
        html = hljs.highlightAuto(code).value
      }
    } else {
      html = hljs.highlightAuto(code).value
    }
    
    // If no line highlighting, return as is
    if (!highlightLines) return html
    
    // Split by newlines to apply highlighting
    // Note: hljs output might contain spans spanning multiple lines, which makes this tricky.
    // A robust solution would need a proper tokenizer or a plugin.
    // For now, we'll try a simpler approach: wrap the whole thing in a div and use CSS/JS to highlight lines? 
    // Or just render lines individually if possible?
    // Rendering lines individually breaks multi-line tokens (like comments).
    // So we should stick to the block rendering but maybe add a background overlay for lines?
    return html
  }, [code, lang, highlightLines])

  return (
    <div className="relative">
      {highlightLines && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {code.split('\n').map((_, i) => (
            <div 
              key={i} 
              className={`w-full h-[1.5em] ${highlightLines.has(i + 1) ? 'bg-yellow-100/30 dark:bg-yellow-500/10 border-l-2 border-yellow-500' : ''}`}
            />
          ))}
        </div>
      )}
      <code
        className={`hljs language-${lang} !bg-transparent !p-0 block leading-[1.5em] relative z-10`}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  )
})

const AnnotatedRow = React.memo(({ row, lang, wrapClass, isBeside }: { row: AnnotatedCodeRow; lang: string; wrapClass: string; isBeside: boolean }) => {
  if (!row.code.trim() && !row.annotation) return null

  // For Inline mode (!isBeside), we want to show Annotation then Code to match source order if that's preferred,
  // OR we keep it as is.
  // User request: "when Inline, show the code as-is from source without reordering".
  // If source is:
  // // Annotation
  // Code
  // Then we should render Annotation first.
  // But AnnotatedCodeRow splits by patterns.
  // Let's swap the render order for !isBeside.
  
  const codeBlock = (
    <div className={`annotate-code flex-1 min-w-0 p-4 bg-white dark:bg-[#0d1117] overflow-x-auto ${!isBeside && row.annotation ? 'border-b border-dashed border-gray-200 dark:border-gray-800' : ''}`}>
      <pre className={`m-0 p-0 bg-transparent ${wrapClass} font-mono text-sm`}>
        <HighlightedCode code={row.code} lang={lang} highlightLines={null} />
      </pre>
    </div>
  )

  const annotationBlock = row.annotation ? (
    <div className={`annotate-note flex-shrink-0 p-4 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-600 dark:text-gray-400 ${isBeside ? 'w-full lg:w-72 border-t lg:border-t-0 lg:border-l' : 'w-full'} border-gray-100 dark:border-gray-800`}>
      <div className="prose prose-xs max-w-none dark:prose-invert">
        <p className="whitespace-pre-wrap leading-relaxed m-0">{row.annotation}</p>
      </div>
    </div>
  ) : null

  return (
    <div className={`annotate-row flex ${isBeside ? 'flex-col lg:flex-row-reverse' : 'flex-col'} border-b border-gray-100 dark:border-gray-800 last:border-0 group/row relative transition-shadow duration-200`}>
      {/* Hover border overlay */}
      <div className="absolute inset-0 pointer-events-none border-2 border-transparent group-hover/row:border-blue-500 z-10 transition-colors duration-200" />
      
      {/* 
        Unified render order: Annotation then Code.
        - Inline: flex-col -> Annotation top, Code bottom.
        - Beside (mobile): flex-col -> Annotation top, Code bottom.
        - Beside (desktop): flex-row-reverse -> Code left, Annotation right.
      */}
      {annotationBlock}
      {codeBlock}
    </div>
  )
})

export const MarkdownCodeBlock = React.memo(function MarkdownCodeBlock({
  token: t,
  highlightClass,
  opts,
  wrapClass,
  highlightStyle,
  annotateDisplayMode,
}: MarkdownCodeBlockProps) {
  const [localViewMode, setLocalViewMode] = useState<'inline' | 'beside' | null>(null)
  const containerRef = React.useRef<HTMLElement>(null)

  React.useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById(HLJS_STYLE_ID)) return
    const styleEl = document.createElement('style')
    styleEl.id = HLJS_STYLE_ID
    styleEl.textContent = HLJS_THEME_CSS
    document.head.appendChild(styleEl)
  }, [])

  const c = t as unknown as TokensCode & { info?: string }
  const meta = parseCodeInfoMeta(c)
  const lang = String(meta.lang || '').trim().toLowerCase()
  const isMermaidLang = lang === 'mermaid' || lang === 'mmd'
  
  // Parse line highlighting from meta.info (e.g. "ts {1-3,5}")
  const highlightLines = useMemo(() => {
    const info = c.info || ''
    const match = info.match(/\{([\d,-]+)\}/)
    if (!match) return null
    const rangeStr = match[1]
    const lines = new Set<number>()
    rangeStr.split(',').forEach(part => {
      const [start, end] = part.split('-').map(n => parseInt(n, 10))
      if (!isNaN(start)) {
        if (!isNaN(end)) {
          for (let i = start; i <= end; i++) lines.add(i)
        } else {
          lines.add(start)
        }
      }
    })
    return lines
  }, [c.info])
  const effectiveViewMode = localViewMode ?? annotateDisplayMode ?? 'inline'
  const isBeside = effectiveViewMode === 'beside'

  const handleToggleMode = (mode: 'inline' | 'beside') => {
    if (mode === effectiveViewMode) return
    
    // Capture relative scroll position
    const el = containerRef.current
    let offsetFromTop = 0
    if (el) {
      const rect = el.getBoundingClientRect()
      offsetFromTop = rect.top
    }
    
    setLocalViewMode(mode)
    
    // Restore relative position after render
    requestAnimationFrame(() => {
        if (el) {
            const rect = el.getBoundingClientRect()
            const diff = rect.top - offsetFromTop
            if (diff !== 0) {
                // Try scrolling the window
                window.scrollBy({ top: diff, behavior: 'auto' })
            }
        }
    })
  }

  // Parse for annotation view if needed
  const annotatedRows = useMemo(() => {
    if (isMermaidLang) return null
    // Attempt to parse annotations regardless of mode, but fallback to raw if empty
    const rows = parseAnnotatedCode(c.text, lang, t.startLine)
    // If no annotations found (single row with null annotation), we might treat it differently
    if (rows.length === 1 && !rows[0].annotation) return null
    return rows
  }, [c.text, isMermaidLang, lang, t.startLine])

  const containerClassName = [
    `rounded-lg border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} overflow-hidden shadow-sm text-sm my-4 group highlight highlight-source-${lang} transition-shadow duration-200`,
  ]
    .filter(Boolean)
    .join(' ')

  if (isMermaidLang) {
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
    <MarkdownBlockContainer
      as="figure"
      ref={containerRef}
      className={containerClassName}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={t.startLine}
      endLine={t.endLine}
    >
      <header
        className={`flex items-center justify-between px-3 py-1.5 border-b ${UI_THEME_TOKENS.panel.border} bg-gray-50/50 dark:bg-gray-800/50`}
      >
        <span className="flex-1 font-mono text-xs text-gray-600 dark:text-gray-400 font-semibold uppercase">
          {lang || 'text'}
        </span>

        <div className="annotate-toggle flex items-center mr-2 bg-gray-200/50 dark:bg-gray-700/50 rounded-md p-0.5">
          <button
            type="button"
            name="annotate-display"
            value="beside"
            className={`annotate-option px-2 py-0.5 text-xs rounded-sm transition-colors ${
              isBeside
                ? 'selected bg-white dark:bg-gray-600 shadow-sm text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            aria-current={isBeside ? 'true' : undefined}
            onClick={() => handleToggleMode('beside')}
          >
            Beside
          </button>
          <button
            type="button"
            name="annotate-display"
            value="inline"
            className={`annotate-option px-2 py-0.5 text-xs rounded-sm transition-colors ${
              !isBeside
                ? 'selected bg-white dark:bg-gray-600 shadow-sm text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            aria-current={!isBeside ? 'true' : undefined}
            onClick={() => handleToggleMode('inline')}
          >
            Inline
          </button>
        </div>

        <ClipboardCopyButton text={c.text} />
      </header>

      {annotatedRows ? (
         <div className="flex flex-col bg-white dark:bg-[#0d1117]">
             {annotatedRows.map(row => (
                 <AnnotatedRow key={row.id} row={row} lang={lang} wrapClass={wrapClass} isBeside={isBeside} />
             ))}
         </div>
      ) : (
        <div className="relative overflow-auto p-4 bg-white dark:bg-[#0d1117]">
          <pre className={`m-0 p-0 bg-transparent ${wrapClass} font-mono text-sm`}>
            <HighlightedCode code={c.text} lang={lang} highlightLines={highlightLines} />
          </pre>
        </div>
      )}
    </MarkdownBlockContainer>
  )
})
