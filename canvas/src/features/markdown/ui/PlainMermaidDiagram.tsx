import React from 'react'
import { postprocessMermaidSvg, renderPlainMermaidSvgCached } from '@/lib/mermaid/mermaidSvg'
import { normalizeMermaidCodeForRuntime } from 'grph-shared/markdown/mermaidInput'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { CARD_MARKDOWN_PREVIEW_MERMAID_SURFACE_CLASS_NAME } from '@/lib/cards/cardMarkdownPreviewUtils'

export function PlainMermaidDiagram({
  code,
  rootThemeMode,
  cardPreviewMode = false,
  selectedLabels,
  dimUnselected = false,
}: {
  code: string
  rootThemeMode: 'light' | 'dark'
  cardPreviewMode?: boolean
  selectedLabels?: readonly string[] | null
  dimUnselected?: boolean
}) {
  const [baseSvg, setBaseSvg] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const selectedSvg = React.useMemo(
    () => applyPlainMermaidDiagramSelection(baseSvg, selectedLabels || [], dimUnselected),
    [baseSvg, selectedLabels, dimUnselected],
  )

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const normalized = normalizeMermaidCodeForRuntime(String(code || '').trim())
        if (!normalized) {
          if (!cancelled) {
            setError('Mermaid diagram code is empty')
            setBaseSvg('')
          }
          return
        }
        const out = await renderPlainMermaidSvgCached({
          code: normalized,
          theme: rootThemeMode === 'dark' ? 'dark' : 'light',
        })
        if (cancelled) return
        const processed = postprocessMermaidSvg(out.svg)
        const renderError = processed.error
        if (renderError) {
          setError(renderError)
          setBaseSvg('')
          return
        }
        setError(null)
        setBaseSvg(processed.svg)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setBaseSvg('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, rootThemeMode])

  if (error) {
    return <section className="text-xs text-red-600 dark:text-red-400">{error}</section>
  }

  if (!selectedSvg) return null

  return (
    <section
      className={cardPreviewMode
        ? CARD_MARKDOWN_PREVIEW_MERMAID_SURFACE_CLASS_NAME
        : `overflow-auto rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`}
      style={cardPreviewMode ? { touchAction: 'pan-y' } : undefined}
      dangerouslySetInnerHTML={{ __html: selectedSvg }}
    />
  )
}

export default PlainMermaidDiagram

const normalizeSelectionText = (value: string): string => {
  return String(value || '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

const selectionTextMatches = (text: string, labels: readonly string[]): boolean => {
  const normalizedText = normalizeSelectionText(text)
  if (!normalizedText) return false
  return labels.some(label => {
    const normalizedLabel = normalizeSelectionText(label)
    if (!normalizedLabel) return false
    return normalizedText === normalizedLabel || normalizedText.includes(normalizedLabel) || normalizedLabel.includes(normalizedText)
  })
}

const findMermaidSelectionElement = (element: Element): Element => {
  let current: Element | null = element
  let selected: Element = element
  while (current?.parentElement && current.parentElement.tagName.toLowerCase() !== 'svg') {
    if (current.tagName.toLowerCase() === 'g') selected = current
    current = current.parentElement
  }
  return selected
}

export const applyPlainMermaidDiagramSelection = (
  svg: string,
  selectedLabels: readonly string[],
  dimUnselected: boolean,
): string => {
  const labels = selectedLabels.map(label => String(label || '').trim()).filter(Boolean)
  if (!svg || !dimUnselected || !labels.length || typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return svg
  }
  try {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
    const root = doc.documentElement
    if (!root || root.tagName.toLowerCase() !== 'svg') return svg
    const selectedTargets: Element[] = []
    for (const element of Array.from(root.querySelectorAll('text,tspan,title,desc'))) {
      if (!selectionTextMatches(element.textContent || '', labels)) continue
      const target = findMermaidSelectionElement(element)
      target.setAttribute('data-kg-mermaid-row-selected', '1')
      element.setAttribute('data-kg-mermaid-row-selected', '1')
      if (!selectedTargets.includes(target)) selectedTargets.push(target)
    }
    if (!selectedTargets.length) return svg
    for (const group of Array.from(root.querySelectorAll('g'))) {
      const isSelectedTree = selectedTargets.some(target => group === target || group.contains(target) || target.contains(group))
      if (!isSelectedTree) group.setAttribute('data-kg-mermaid-row-dimmed', '1')
    }
    root.setAttribute('data-kg-mermaid-selection-active', '1')
    const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = [
      'svg[data-kg-mermaid-selection-active="1"] [data-kg-mermaid-row-dimmed="1"] { opacity: 0.24; }',
      'svg[data-kg-mermaid-selection-active="1"] [data-kg-mermaid-row-selected="1"] { opacity: 1 !important; filter: drop-shadow(0 0 4px rgba(37,99,235,.55)); }',
      'svg[data-kg-mermaid-selection-active="1"] text[data-kg-mermaid-row-selected="1"], svg[data-kg-mermaid-selection-active="1"] tspan[data-kg-mermaid-row-selected="1"] { font-weight: 700; }',
    ].join('\n')
    root.insertBefore(style, root.firstChild)
    return new XMLSerializer().serializeToString(root)
  } catch {
    return svg
  }
}
