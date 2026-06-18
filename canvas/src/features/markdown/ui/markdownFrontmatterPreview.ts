import type { MarkdownDataView } from './markdownDataViewModel'
import type { RenderOpts } from './MarkdownRendererTypes'
import type { MarkdownVariableSsotEntry } from './markdownVariableReferences'
import type { TokenWithLines } from './markdownPreviewLex'

const FRONTMATTER_PREVIEW_MAX_ROWS = 120
const FRONTMATTER_PREVIEW_MAX_JSON_CHARS = 800
const FRONTMATTER_PREVIEW_MAX_ARRAY_ITEMS = 48
const FRONTMATTER_PREVIEW_MAX_OBJECT_KEYS = 64

const truncateFrontmatterPreview = (text: string): string => {
  if (text.length <= FRONTMATTER_PREVIEW_MAX_JSON_CHARS) return text
  return `${text.slice(0, FRONTMATTER_PREVIEW_MAX_JSON_CHARS)}…`
}

const formatFrontmatterCollectionSummary = (kind: 'array' | 'object', size: number): string => {
  return kind === 'array' ? `[${size} items]` : `{${size} keys}`
}

export function stringifyMarkdownFrontmatterPreviewValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (value.length > FRONTMATTER_PREVIEW_MAX_ARRAY_ITEMS) {
      return `\`${formatFrontmatterCollectionSummary('array', value.length)}\``
    }
    try {
      return `\`${truncateFrontmatterPreview(JSON.stringify(value))}\``
    } catch {
      return ''
    }
  }
  if (value == null) return '—'
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>)
    if (keys.length > FRONTMATTER_PREVIEW_MAX_OBJECT_KEYS) {
      return `\`${formatFrontmatterCollectionSummary('object', keys.length)}\``
    }
    try {
      return `\`${truncateFrontmatterPreview(JSON.stringify(value))}\``
    } catch {
      return ''
    }
  }
  return ''
}

export function buildMarkdownFrontmatterPreviewRows(args: {
  frontmatterMeta: Record<string, unknown>
  variableSsotEntries: ReadonlyArray<MarkdownVariableSsotEntry>
}): Array<{ key: string; line: number; source: 'frontmatter' }> {
  const fromSsot = args.variableSsotEntries.filter(entry => entry.source === 'frontmatter')
  const filteredSsot = fromSsot.filter(entry => String(entry.key || '').trim().toLowerCase() !== 'mermaid')
  if (filteredSsot.length > 0) {
    return filteredSsot.slice(0, FRONTMATTER_PREVIEW_MAX_ROWS).map(entry => ({
      key: entry.key,
      line: entry.line,
      source: 'frontmatter',
    }))
  }
  return Object.keys(args.frontmatterMeta)
    .filter(key => String(key || '').trim().toLowerCase() !== 'mermaid')
    .slice(0, FRONTMATTER_PREVIEW_MAX_ROWS)
    .map(key => ({
      key,
      line: 1,
      source: 'frontmatter' as const,
    }))
}

export function buildMarkdownFrontmatterPreviewTable(args: {
  frontmatterMeta: Record<string, unknown>
  variableSsotEntries: ReadonlyArray<MarkdownVariableSsotEntry>
}): {
  view: MarkdownDataView
  lineByKey: Map<string, number>
} | null {
  const rows = buildMarkdownFrontmatterPreviewRows(args)
  if (rows.length === 0) return null

  const lineByKey = new Map<string, number>()
  const view: MarkdownDataView = {
    columns: [
      { id: 'frontmatter-key', name: 'key', kind: 'text' },
      { id: 'frontmatter-value', name: 'Value', kind: 'text' },
    ],
    rows: rows.map((entry, idx) => {
      lineByKey.set(entry.key.toLowerCase(), entry.line)
      return {
        id: `frontmatter-row:${idx}:${entry.key}`,
        cells: [entry.key, stringifyMarkdownFrontmatterPreviewValue(args.frontmatterMeta[entry.key]) || ''],
      }
    }),
    titleColumnId: 'frontmatter-key',
    groupByColumnId: null,
  }

  return {
    view,
    lineByKey,
  }
}

export function buildMarkdownFrontmatterPreviewCodeToken(args: {
  lang: string
  text: string
  startLine: number
}): TokenWithLines {
  const lines = String(args.text || '').split('\n').length
  return {
    type: 'code',
    raw: args.text,
    text: args.text,
    lang: args.lang,
    info: args.lang,
    startLine: args.startLine,
    endLine: Math.max(args.startLine, args.startLine + Math.max(0, lines - 1)),
  } as unknown as TokenWithLines
}

export function buildMarkdownFrontmatterPreviewRenderOpts(args: {
  activeDocumentPath: string
  highlightedLineRange: RenderOpts['highlightedLineRange']
  markdownWordWrap: boolean
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  stickyHeadingTopClass?: string
  stickyHeadingTopPx?: number
  mermaidFrontmatterConfig: RenderOpts['mermaidFrontmatterConfig']
  rootThemeMode: RenderOpts['rootThemeMode']
  previewOverlayScope: RenderOpts['previewOverlayScope']
  previewOverlayPortalTarget?: RenderOpts['previewOverlayPortalTarget']
  codeAnnotations?: RenderOpts['codeAnnotations']
  collapsedIds?: RenderOpts['collapsedIds']
  onToggleCollapse?: RenderOpts['onToggleCollapse']
  geoDatasetIntegration?: RenderOpts['geoDatasetIntegration']
  forbidCopy?: boolean
  deferMermaidRender?: boolean
  markdownViewerMediaMode?: RenderOpts['markdownViewerMediaMode']
}): RenderOpts {
  return {
    activeDocumentPath: args.activeDocumentPath,
    highlightedLineRange: args.highlightedLineRange,
    markdownWordWrap: args.markdownWordWrap,
    markdownPresentationMode: false,
    uiPanelTextFontClass: args.uiPanelTextFontClass,
    uiPanelMonospaceTextClass: args.uiPanelMonospaceTextClass,
    stickyHeadingTopClass: args.stickyHeadingTopClass,
    stickyHeadingTopPx: args.stickyHeadingTopPx,
    mermaidFrontmatterConfig: args.mermaidFrontmatterConfig,
    rootThemeMode: args.rootThemeMode,
    previewOverlayScope: args.previewOverlayScope,
    previewOverlayPortalTarget: args.previewOverlayPortalTarget,
    codeAnnotations: args.codeAnnotations,
    collapsedIds: args.collapsedIds,
    onToggleCollapse: args.onToggleCollapse,
    geoDatasetIntegration: args.geoDatasetIntegration,
    forbidCopy: args.forbidCopy,
    deferMermaidRender: args.deferMermaidRender,
    markdownViewerMediaMode: args.markdownViewerMediaMode,
  }
}
