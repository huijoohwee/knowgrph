import React from 'react'
import type { TokensCode } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import type { RenderOpts } from './MarkdownRendererTypes'
import { parseCodeInfoMeta } from './markdownCodeInfo'
import { MarkdownBlockContainer } from './MarkdownBlockContainer'
import { MermaidDiagram } from '@/features/panels/views/preview-panel/ui/MermaidDiagram'
import { parseAnnotatedCode, type AnnotatedCodeRow } from './markdownAnnotatedCode'
import { mergeMermaidInitConfig, splitMermaidBlockFrontmatter } from './mermaidBlockFrontmatter'
import { splitMermaidIntoDiagrams } from 'grph-shared/markdown/mermaidBlocks'
import { isMermaidCodeFenceLang } from 'grph-shared/markdown/mermaidInput'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_COPY } from '@/lib/config'
import {
  MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS,
  MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS,
  MarkdownBlockDropMarkers,
  MarkdownBlockGutterControls,
  useMarkdownLineBlockDnD,
} from './MarkdownBlockGutter'
import { ensureHljsThemeStyle } from './codeblock/hljsTheme'
import { ClipboardCopyButton } from './codeblock/ClipboardCopyButton'
import { AnnotateDisplayModeToggle, AnnotatedRow, type AnnotateDisplayMode } from './codeblock/CodeAnnotationRows'
import { GeoJsonGeoPanelRenderer } from './codeblock/GeoJsonGeoPanelRenderer'
import { HighlightedCode } from './codeblock/HighlightedCode'
import { HtmlCodeBlockRenderer } from './codeblock/HtmlCodeBlockRenderer'
import { encodeUtf8ToBase64 } from '@/features/markdown/markdownRoundTrip'
import { useForbidBrowserZoomWheel } from '@/lib/ui/forbidBrowserZoom'

type MarkdownCodeBlockProps = {
  token: TokenWithLines
  highlightClass: string
  opts: RenderOpts
  wrapClass: string
  highlightStyle?: React.CSSProperties
  fragmentStep?: number
  fragmentsEnabled?: boolean
  fragmentClassNames?: string[]
  fragmentTags?: string[]
  annotateDisplayMode?: AnnotateDisplayMode
}

const buildGeoReq = (args: {
  activeDocumentPath: string
  lang: 'geojson' | 'json'
  text: string
  startLine: number
  endLine: number
}) => {
  return {
    sourceDocumentPath: args.activeDocumentPath,
    codeBlock: { lang: args.lang, text: args.text, startLine: args.startLine, endLine: args.endLine },
  }
}

export const MarkdownCodeBlock = React.memo(function MarkdownCodeBlock({
  token: t,
  highlightClass,
  opts,
  wrapClass,
  highlightStyle,
  fragmentStep: _fragmentStep,
  fragmentsEnabled,
  fragmentClassNames,
  fragmentTags,
  annotateDisplayMode,
}: MarkdownCodeBlockProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const containerRef = React.useRef<HTMLElement>(null)
  useForbidBrowserZoomWheel(containerRef, true)

  React.useEffect(() => {
    ensureHljsThemeStyle()
  }, [])

  const c = t as unknown as TokensCode & { info?: string }
  const codeText = String((c as { text?: unknown }).text ?? '')
  const meta = parseCodeInfoMeta(c)
  const lang = String(meta.lang || '').trim().toLowerCase()
  const isMermaidLang = isMermaidCodeFenceLang(lang)
  const isSvgOnlyFence =
    !lang && /<\s*svg\b/i.test(codeText) && /<\/\s*svg\s*>/i.test(codeText)
  const isHtmlLang = lang === 'html' || lang === 'htm' || lang === 'svg' || isSvgOnlyFence
  const isSvgFence = lang === 'svg' || isSvgOnlyFence
  const isAsciiDiagram =
    lang === 'ascii' ||
    lang === 'grid' ||
    lang === 'diagram' ||
    /[┌┐└┘┬┴┼│─╔╗╚╝╦╩╬║═]/.test(codeText) ||
    (/(^|\n)\s*\+[-+]{3,}\+\s*(\n|$)/.test(codeText) && /\|/.test(codeText))

  const highlightLines = React.useMemo(() => {
    const info = c.info || ''
    const match = info.match(/\{([\d,-]+)\}/)
    if (!match) return null
    const rangeStr = match[1]
    const lines = new Set<number>()
    rangeStr.split(',').forEach(part => {
      const [start, end] = part.split('-').map(n => parseInt(n, 10))
      if (!Number.isFinite(start)) return
      if (Number.isFinite(end)) {
        for (let i = start; i <= end; i += 1) lines.add(i)
      } else {
        lines.add(start)
      }
    })
    return lines
  }, [c.info])

  const isGeoJsonRenderable = React.useMemo(() => {
    const integration = opts.geoDatasetIntegration
    const normalizedLang: 'geojson' | 'json' | null =
      lang === 'geojson' ? 'geojson' : lang === 'json' ? 'json' : null
    const req = buildGeoReq({
      activeDocumentPath: opts.activeDocumentPath,
      lang: normalizedLang || 'json',
      text: codeText,
      startLine: t.startLine,
      endLine: t.endLine || t.startLine,
    })

    if (normalizedLang) {
      if (normalizedLang === 'geojson') return true
      if (normalizedLang === 'json' && typeof integration?.isGeoJsonCodeBlock === 'function') {
        try {
          return !!integration.isGeoJsonCodeBlock(req)
        } catch {
          return false
        }
      }
      return false
    }

    if (typeof integration?.isGeoJsonCodeBlock === 'function') {
      try {
        return !!integration.isGeoJsonCodeBlock(req)
      } catch {
        return false
      }
    }
    return false
  }, [codeText, lang, opts.activeDocumentPath, opts.geoDatasetIntegration, t.endLine, t.startLine])

  const mermaidBlock = React.useMemo(() => {
    if (!isMermaidLang) return null
    return splitMermaidBlockFrontmatter(codeText)
  }, [codeText, isMermaidLang])

  const defaultMode: AnnotateDisplayMode = annotateDisplayMode ?? 'inline'
  const baseMode: AnnotateDisplayMode = isGeoJsonRenderable || isMermaidLang ? 'render' : defaultMode
  const [localMode, setLocalMode] = React.useState<AnnotateDisplayMode>(() => baseMode)
  const [localOverride, setLocalOverride] = React.useState(false)

  React.useEffect(() => {
    if (!localOverride) return
    if (localMode !== baseMode) return
    setLocalOverride(false)
  }, [baseMode, localMode, localOverride])

  React.useEffect(() => {
    if (localOverride) return
    setLocalMode(baseMode)
  }, [baseMode, localOverride])

  const clearOverride = React.useCallback(() => {
    setLocalOverride(false)
    setLocalMode(baseMode)
  }, [baseMode])

  const effectiveViewMode = localMode
  const isRender = effectiveViewMode === 'render'
  const isBeside = effectiveViewMode === 'beside'
  const monospaceCodeClass = React.useMemo(() => {
    const base = String(opts.uiPanelMonospaceTextClass || '').trim() || 'font-mono text-xs'
    return opts.markdownPresentationMode ? `${base} text-xl` : base
  }, [opts.markdownPresentationMode, opts.uiPanelMonospaceTextClass])

  const annotatedRows: AnnotatedCodeRow[] | null = React.useMemo(() => {
    if (isMermaidLang || isAsciiDiagram) return null
    const rows = parseAnnotatedCode(codeText, lang, t.startLine)
    if (rows.length === 1 && !rows[0].annotation) return null
    return rows
  }, [codeText, isAsciiDiagram, isMermaidLang, lang, t.startLine])

  const endLine = t.endLine || t.startLine
  const blockControlsAllowed =
    !opts.markdownPresentationMode &&
    !!opts.viewerBlockEditingEnabled &&
    opts.markdownBlockControlsEnabled !== false
  const canInsertLine = blockControlsAllowed && !!opts.onInsertLineAfter && Number.isFinite(endLine)
  const canReorder = blockControlsAllowed && !!opts.onReorderLineBlock && Number.isFinite(t.startLine)
  const gutterEnabled = (canInsertLine || canReorder) && opts.markdownBlockGutterEnabled !== false
  const gutterLayoutEnabled = opts.markdownBlockGutterEnabled !== false

  const dnd = useMarkdownLineBlockDnD({
    enabled: canReorder,
    targetStartLine: t.startLine,
    targetEndLine: endLine,
    onReorder: (source, target, position) => opts.onReorderLineBlock?.(source, target, position),
  })

  const figureClassName = `rounded-lg border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} overflow-hidden shadow-sm highlight highlight-source-${lang} transition-shadow duration-200`

  const asciiNode = (
    <section className={`relative overflow-auto ${UI_THEME_TOKENS.code.bg} ${UI_THEME_TOKENS.code.text}`}>
      <pre className={`m-0 p-3 bg-transparent whitespace-pre ${monospaceCodeClass} text-[10px] leading-4`}>
        {codeText}
      </pre>
    </section>
  )

  const contentNode = (
    <>
      <header
        className={`flex items-center justify-between px-3 py-1.5 border-b ${UI_THEME_TOKENS.panel.border} bg-gray-50/50 dark:bg-gray-800/50`}
      >
        <span className="flex-1 font-mono text-xs text-gray-600 dark:text-gray-400 font-semibold uppercase">
          {lang || 'text'}
        </span>

        <menu className="flex items-center gap-2" aria-label={UI_COPY.markdownCodeBlockActionsLabel}>
          <AnnotateDisplayModeToggle
            baseMode={baseMode}
            mode={localMode}
            setMode={next => {
              setLocalOverride(true)
              setLocalMode(next)
            }}
            clearOverride={clearOverride}
          />
          <ClipboardCopyButton text={codeText} />
        </menu>
      </header>

      {isAsciiDiagram ? (
        asciiNode
      ) : isRender ? (
        <section className={`relative ${isMermaidLang ? 'overflow-hidden' : 'overflow-auto'} ${UI_THEME_TOKENS.code.bg} ${UI_THEME_TOKENS.code.text}`}>
          {isMermaidLang ? (
            <section className="flex flex-col gap-3 p-3">
              {(() => {
                const base = mermaidBlock?.diagramCode ?? codeText
                const diagrams = splitMermaidIntoDiagrams(base)
                const fm = mergeMermaidInitConfig(opts.mermaidFrontmatterConfig, mermaidBlock?.mergedInitConfig ?? null)
                return diagrams.map((diagramCode, index) => (
                  <MermaidDiagram
                    key={index}
                    code={diagramCode}
                    highlightClass={highlightClass}
                    frontmatterConfig={fm}
                    rootThemeMode={opts.rootThemeMode}
                    overlayScope={opts.previewOverlayScope}
                    overlayPortalTarget={opts.previewOverlayPortalTarget}
                    variant="codeblock"
                    enablePanZoom
                    wheelZoomRequiresModifier={false}
                    wheelZoomBehavior="active"
                  />
                ))
              })()}
            </section>
          ) : isGeoJsonRenderable ? (
            <GeoJsonGeoPanelRenderer
              lang={lang === 'geojson' ? 'geojson' : 'json'}
              text={codeText}
              startLine={t.startLine}
              endLine={t.endLine || t.startLine}
              opts={opts}
              monospaceCodeClass={monospaceCodeClass}
            />
          ) : isHtmlLang ? (
            (() => {
              if (!isSvgFence) {
                return (
                  <HtmlCodeBlockRenderer
                    html={codeText}
                    opts={opts}
                    fragmentsEnabled={fragmentsEnabled}
                    fragmentStep={_fragmentStep}
                    fragmentClassNames={fragmentClassNames}
                    fragmentTags={fragmentTags}
                  />
                )
              }
              const svgMatch = codeText.match(/<\s*svg\b[\s\S]*<\/\s*svg\s*>/i)
              const svgRaw = String(svgMatch?.[0] || '').trim()
              if (!svgRaw) {
                return (
                  <HtmlCodeBlockRenderer
                    html={codeText}
                    opts={opts}
                    fragmentsEnabled={fragmentsEnabled}
                    fragmentStep={_fragmentStep}
                    fragmentClassNames={fragmentClassNames}
                    fragmentTags={fragmentTags}
                  />
                )
              }
              if (/<\s*use\b/i.test(svgRaw) && /(xlink:href|href)\s*=\s*["']\s*#/.test(svgRaw)) {
                const idMatch = svgRaw.match(
                  /<(?:\s*use\b)[^>]*\s(?:xlink:href|href)\s*=\s*["']\s*#([^"'\s>]+)\s*["'][^>]*>/i,
                )
                const id = String(idMatch?.[1] || '').trim()
                const hasSymbol = id
                  ? new RegExp(
                      `<\\s*symbol\\b[^>]*\\bid\\s*=\\s*["']\\s*${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*["']`,
                      'i',
                    ).test(svgRaw)
                  : false
                if (!hasSymbol) {
                  return (
                    <HtmlCodeBlockRenderer
                      html={codeText}
                      opts={opts}
                      fragmentsEnabled={fragmentsEnabled}
                      fragmentStep={_fragmentStep}
                      fragmentClassNames={fragmentClassNames}
                      fragmentTags={fragmentTags}
                    />
                  )
                }
              }

              const sanitizeSvg = (raw: string): string => {
                try {
                  const win = (globalThis as unknown as { window?: Window }).window
                  const DomParserCtor = (globalThis as unknown as { DOMParser?: typeof DOMParser }).DOMParser
                  if (!win || !DomParserCtor) return raw
                  const parser = new DomParserCtor()
                  const doc = parser.parseFromString(raw, 'image/svg+xml')
                  const root = doc.documentElement
                  const nodes = root ? root.querySelectorAll('*') : []
                  for (const node of Array.from(nodes)) {
                    const tag = node.tagName.toLowerCase()
                    if (tag === 'script') {
                      node.remove()
                      continue
                    }
                    for (const name of node.getAttributeNames()) {
                      const lower = name.toLowerCase()
                      if (lower.startsWith('on')) node.removeAttribute(name)
                      if (lower === 'href' || lower === 'xlink:href') {
                        const v = String(node.getAttribute(name) || '')
                        if (v && !v.startsWith('#')) node.removeAttribute(name)
                      }
                    }
                  }
                  const out = new XMLSerializer().serializeToString(root)
                  return out || raw
                } catch {
                  return raw
                }
              }

              const sanitizedSvg = sanitizeSvg(svgRaw)
              const src = `data:image/svg+xml;base64,${encodeUtf8ToBase64(sanitizedSvg)}`
              const alt = (() => {
                const m =
                  sanitizedSvg.match(/\baria-label\s*=\s*["']([^"']+)["']/i) ||
                  sanitizedSvg.match(/\bdata-icon\s*=\s*["']([^"']+)["']/i)
                return String(m?.[1] || '').trim()
              })()
              return (
                <section className={`relative overflow-auto p-4 ${UI_THEME_TOKENS.code.bg} ${UI_THEME_TOKENS.code.text}`}>
                  <img
                    src={src}
                    alt={alt}
                    className="inline-block max-w-full h-auto rounded border border-gray-200"
                  />
                </section>
              )
            })()
          ) : (
            <section className="relative overflow-auto p-4">
              <pre className={`m-0 p-0 bg-transparent ${wrapClass} ${monospaceCodeClass}`}>
                <HighlightedCode code={codeText} lang={lang} highlightLines={highlightLines} />
              </pre>
            </section>
          )}
        </section>
      ) : annotatedRows ? (
        <section className={`flex flex-col ${UI_THEME_TOKENS.code.bg} ${UI_THEME_TOKENS.code.text}`}>
          {annotatedRows.map(row => (
            <AnnotatedRow
              key={row.id}
              row={row}
              lang={lang}
              wrapClass={wrapClass}
              isBeside={isBeside}
              textSizeClass={monospaceCodeClass}
            />
          ))}
        </section>
      ) : (
        <section className={`relative overflow-auto p-4 ${UI_THEME_TOKENS.code.bg} ${UI_THEME_TOKENS.code.text}`}>
          <pre className={`m-0 p-0 bg-transparent ${wrapClass} ${monospaceCodeClass}`}>
            <HighlightedCode code={codeText} lang={lang} highlightLines={highlightLines} />
          </pre>
        </section>
      )}
    </>
  )

  if (!gutterLayoutEnabled) {
    return (
      <MarkdownBlockContainer
        as="figure"
        ref={containerRef}
        className={`my-4 ${figureClassName}`}
        highlightClass={highlightClass}
        highlightStyle={highlightStyle}
        startLine={t.startLine}
        endLine={t.endLine}
      >
        {contentNode}
      </MarkdownBlockContainer>
    )
  }

  const wrapperClassName = [
    'my-4 relative group',
    MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS,
    MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS,
    dnd.isDragging ? 'opacity-60' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <MarkdownBlockContainer
      as="section"
      ref={containerRef}
      className={wrapperClassName}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={t.startLine}
      endLine={t.endLine}
      onDragOver={gutterEnabled ? dnd.handleDragOver : undefined}
      onDragLeave={gutterEnabled ? dnd.handleDragLeave : undefined}
      onDrop={gutterEnabled ? dnd.handleDrop : undefined}
    >
      {gutterEnabled ? (
        <>
          <MarkdownBlockDropMarkers dragState={dnd.dragState} />
          <MarkdownBlockGutterControls
            canInsertLine={canInsertLine}
            onInsertLine={() => opts.onInsertLineAfter?.(endLine)}
            canReorder={canReorder}
            onDragStart={dnd.handleDragStart}
            onDragEnd={dnd.handleDragEnd}
            iconSizeClass={iconSizeClass}
            iconStrokeWidth={uiIconStrokeWidth}
            labelReorder={UI_COPY.markdownBlockReorderLineLabel}
            labelInsert={UI_COPY.markdownBlockInsertLineLabel}
          />
        </>
      ) : null}
      <figure className={figureClassName}>{contentNode}</figure>
    </MarkdownBlockContainer>
  )
})
