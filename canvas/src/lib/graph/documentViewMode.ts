import { toMetadataRecord } from '@/lib/graph/documentMetadata'

export type ActiveDocumentViewMode = 'documentStructure' | 'keyword' | 'frontmatter' | 'multiDimTable'
export const ACTIVE_DOCUMENT_VIEW_MODE_META_KEY = 'kg:activeDocumentViewMode' as const
export const DEFAULT_MARKDOWN_PANEL_ALLOWED_KINDS = ['table', 'code', 'blockquote', 'callout', 'html'] as const
export const MULTI_DIM_TABLE_MARKDOWN_PANEL_ALLOWED_KINDS = ['code', 'blockquote', 'callout', 'html'] as const
export type DocumentViewModeArgs = {
  frontmatterModeEnabled: boolean
  multiDimTableModeEnabled: boolean
  documentSemanticMode: string
  documentStructureBaselineLock: boolean
  storyboardStandalone?: boolean
}

export function readDocumentViewModeContext(args: DocumentViewModeArgs): {
  activeDocumentViewMode: ActiveDocumentViewMode
  documentSemanticModeKey: string
  documentSemanticViewModeKey: string
  markdownPanelAllowedKinds: typeof DEFAULT_MARKDOWN_PANEL_ALLOWED_KINDS | typeof MULTI_DIM_TABLE_MARKDOWN_PANEL_ALLOWED_KINDS
  forceDocumentStructureGroups: boolean
} {
  const activeDocumentViewMode = (() => {
    if (args.storyboardStandalone === true) return 'documentStructure'
    if (args.documentStructureBaselineLock === true) return 'documentStructure'
    const semanticMode = String(args.documentSemanticMode || '').trim().toLowerCase() === 'keyword' ? 'keyword' : 'document'
    if (semanticMode === 'keyword') return 'keyword'
    if (args.frontmatterModeEnabled === true) return 'frontmatter'
    if (args.multiDimTableModeEnabled === true) return 'multiDimTable'
    return 'documentStructure'
  })()
  const documentSemanticModeKey = (() => {
    if (args.storyboardStandalone === true) return 'storyboard'
    if (activeDocumentViewMode === 'keyword') return 'keyword'
    if (activeDocumentViewMode === 'multiDimTable') return 'document:mdtbl'
    return 'document'
  })()
  const markdownPanelAllowedKinds = activeDocumentViewMode === 'multiDimTable'
    ? MULTI_DIM_TABLE_MARKDOWN_PANEL_ALLOWED_KINDS
    : DEFAULT_MARKDOWN_PANEL_ALLOWED_KINDS
  return {
    activeDocumentViewMode,
    documentSemanticModeKey,
    documentSemanticViewModeKey: `${documentSemanticModeKey}|mode:${activeDocumentViewMode}`,
    markdownPanelAllowedKinds,
    forceDocumentStructureGroups: activeDocumentViewMode === 'documentStructure',
  }
}

const readDocumentViewModeMetadata = (
  graphData: { metadata?: unknown } | null | undefined,
): Record<string, unknown> => toMetadataRecord(graphData?.metadata)

export function readGraphActiveDocumentViewMode(graphData: { context?: unknown; metadata?: unknown } | null | undefined): ActiveDocumentViewMode | null {
  if (!graphData || typeof graphData !== 'object') return null
  const meta = readDocumentViewModeMetadata(graphData)
  const rawMode = String(meta?.[ACTIVE_DOCUMENT_VIEW_MODE_META_KEY] || '').trim()
  if (rawMode === 'documentStructure' || rawMode === 'keyword' || rawMode === 'frontmatter' || rawMode === 'multiDimTable') {
    return rawMode
  }
  const context = String(graphData.context || '').trim()
  const kind = String(meta?.kind || '').trim()
  const baseGraphKind = String(meta?.baseGraphKind || '').trim()
  if (kind === 'keyword') return 'keyword'
  if (context === 'frontmatter-flow' || context === 'frontmatter-mermaid' || kind === 'frontmatter-flow' || baseGraphKind === 'frontmatter-flow') return 'frontmatter'
  return null
}

export function withActiveDocumentViewMode<T extends { metadata?: unknown }>(graphData: T, mode: ActiveDocumentViewMode): T {
  const current = readGraphActiveDocumentViewMode(graphData as { context?: unknown; metadata?: unknown })
  if (current === mode) return graphData
  const meta = readDocumentViewModeMetadata(graphData)
  return {
    ...graphData,
    metadata: {
      ...meta,
      [ACTIVE_DOCUMENT_VIEW_MODE_META_KEY]: mode,
    },
  }
}
