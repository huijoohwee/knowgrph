import React from 'react'
import { postprocessMermaidSvg, renderPlainMermaidSvgCached } from '@/lib/mermaid/mermaidSvg'
import { normalizeMermaidCodeForRuntime } from 'grph-shared/markdown/mermaidInput'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { CARD_MARKDOWN_PREVIEW_MERMAID_SURFACE_CLASS_NAME } from '@/lib/cards/cardMarkdownPreviewUtils'

export function PlainMermaidDiagram({
  code,
  rootThemeMode,
  cardPreviewMode = false,
}: {
  code: string
  rootThemeMode: 'light' | 'dark'
  cardPreviewMode?: boolean
}) {
  const [svg, setSvg] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const normalized = normalizeMermaidCodeForRuntime(String(code || '').trim())
        if (!normalized) {
          if (!cancelled) setError('Mermaid diagram code is empty')
          return
        }
        const out = await renderPlainMermaidSvgCached({
          code: normalized,
          theme: rootThemeMode === 'dark' ? 'dark' : 'light',
        })
        if (cancelled) return
        const processed = postprocessMermaidSvg(out.svg)
        const nextSvg = processed.svg
        const renderError = processed.error
        if (renderError) {
          setError(renderError)
          setSvg('')
          return
        }
        setError(null)
        setSvg(nextSvg)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setSvg('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, rootThemeMode])

  if (error) {
    return <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
  }

  if (!svg) return null

  return (
    <div
      className={cardPreviewMode
        ? CARD_MARKDOWN_PREVIEW_MERMAID_SURFACE_CLASS_NAME
        : `overflow-auto rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`}
      style={cardPreviewMode ? { touchAction: 'pan-y' } : undefined}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export default PlainMermaidDiagram
