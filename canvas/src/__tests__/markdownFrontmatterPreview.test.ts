import {
  buildMarkdownFrontmatterPreviewCodeToken,
  buildMarkdownFrontmatterPreviewRenderOpts,
  buildMarkdownFrontmatterPreviewRows,
  buildMarkdownFrontmatterPreviewTable,
  stringifyMarkdownFrontmatterPreviewValue,
} from '@/features/markdown/ui/markdownFrontmatterPreview'

export async function testMarkdownFrontmatterPreviewHelpersCentralizeReadViewDerivation() {
  if (stringifyMarkdownFrontmatterPreviewValue(['A', 'B']) !== '`["A","B"]`') {
    throw new Error('expected array frontmatter values to stringify as backtick JSON')
  }
  if (stringifyMarkdownFrontmatterPreviewValue({ venue: 'SG' }) !== '`{"venue":"SG"}`') {
    throw new Error('expected object frontmatter values to stringify as backtick JSON')
  }
  if (stringifyMarkdownFrontmatterPreviewValue(null) !== '—') {
    throw new Error('expected null frontmatter values to stringify as em dash placeholder')
  }

  const frontmatterMeta = {
    title: 'Doc',
    authors: ['A. Author 1', 'B. Author 2'],
    venue: 'Singapore',
    mermaid: 'flowchart TB\nA-->B',
  } satisfies Record<string, unknown>

  const rows = buildMarkdownFrontmatterPreviewRows({
    frontmatterMeta,
    variableSsotEntries: [
      { key: 'title', line: 2, source: 'frontmatter' },
      { key: 'venue', line: 6, source: 'frontmatter' },
      { key: 'mermaid', line: 7, source: 'frontmatter' },
      { key: 'inlineOnly', line: 20, source: 'inline' },
    ],
  })
  const rowKeys = rows.map(row => row.key).join(',')
  if (rowKeys !== 'title,venue') throw new Error(`expected SSOT frontmatter rows without mermaid, got ${rowKeys}`)

  const fallbackRows = buildMarkdownFrontmatterPreviewRows({
    frontmatterMeta,
    variableSsotEntries: [{ key: 'inlineOnly', line: 20, source: 'inline' }],
  })
  const fallbackKeys = fallbackRows.map(row => row.key).join(',')
  if (fallbackKeys !== 'title,authors,venue') throw new Error(`expected fallback frontmatter rows from object keys without mermaid, got ${fallbackKeys}`)

  const previewTable = buildMarkdownFrontmatterPreviewTable({
    frontmatterMeta,
    variableSsotEntries: [
      { key: 'title', line: 2, source: 'frontmatter' },
      { key: 'venue', line: 6, source: 'frontmatter' },
    ],
  })
  if (!previewTable) throw new Error('expected frontmatter preview table to be built')

  const titleColumn = previewTable.view.columns[0]?.name || ''
  const valueColumn = previewTable.view.columns[1]?.name || ''
  if (titleColumn !== 'key' || valueColumn !== 'Value') {
    throw new Error(`expected key/Value columns, got ${titleColumn}/${valueColumn}`)
  }

  const venueRow = previewTable.view.rows.find(row => row.cells[0] === 'venue')
  if (!venueRow) throw new Error('expected venue row in preview table')
  if (previewTable.lineByKey.get('venue') !== 6) {
    throw new Error(`expected venue line lookup to be 6, got ${String(previewTable.lineByKey.get('venue') || 0)}`)
  }

  const authorsFallbackTable = buildMarkdownFrontmatterPreviewTable({
    frontmatterMeta,
    variableSsotEntries: [],
  })
  const authorsRow = authorsFallbackTable?.view.rows.find(row => row.cells[0] === 'authors') || null
  if (!authorsRow || authorsRow.cells[1] !== '`["A. Author 1","B. Author 2"]`') {
    throw new Error(`expected authors fallback row to preserve backtick JSON array value, got ${JSON.stringify(authorsRow || null)}`)
  }

  const mermaidToken = buildMarkdownFrontmatterPreviewCodeToken({
    lang: 'mermaid',
    text: 'flowchart TB\nA-->B',
    startLine: 1,
  })
  const mermaidTokenLang = 'lang' in mermaidToken ? mermaidToken.lang : undefined
  if (mermaidToken.type !== 'code' || mermaidTokenLang !== 'mermaid' || mermaidToken.endLine !== 2) {
    throw new Error(`expected shared frontmatter mermaid code token contract, got ${JSON.stringify(mermaidToken)}`)
  }

  const renderOpts = buildMarkdownFrontmatterPreviewRenderOpts({
    activeDocumentPath: 'docs/frontmatter.md',
    highlightedLineRange: null,
    markdownWordWrap: true,
    uiPanelTextFontClass: 'font-sans text-xs',
    uiPanelMonospaceTextClass: 'font-mono text-xs',
    stickyHeadingTopClass: 'top-0',
    stickyHeadingTopPx: 12,
    mermaidFrontmatterConfig: null,
    rootThemeMode: 'light',
    previewOverlayScope: 'container',
    previewOverlayPortalTarget: null,
    codeAnnotations: { demo: 'annotation' },
    collapsedIds: new Set(['intro']),
    onToggleCollapse: () => void 0,
    geoDatasetIntegration: undefined,
    forbidCopy: true,
  })
  if (renderOpts.markdownPresentationMode !== false || renderOpts.previewOverlayScope !== 'container') {
    throw new Error(`expected shared frontmatter render opts to preserve viewer mode defaults, got ${JSON.stringify(renderOpts)}`)
  }
  if (renderOpts.stickyHeadingTopPx !== 12 || renderOpts.forbidCopy !== true || renderOpts.collapsedIds?.has('intro') !== true) {
    throw new Error('expected shared frontmatter render opts to preserve sticky/collapse/copy configuration')
  }
}
