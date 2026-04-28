export type ActiveDocumentViewMode = 'documentStructure' | 'keyword' | 'frontmatter' | 'multiDimTable'
export const ACTIVE_DOCUMENT_VIEW_MODE_META_KEY = 'kg:activeDocumentViewMode' as const

export function normalizeDocumentSemanticMode(raw: string): 'document' | 'keyword' {
  return String(raw || '').trim().toLowerCase() === 'keyword' ? 'keyword' : 'document'
}

export function resolveActiveDocumentViewMode(args: {
  frontmatterModeEnabled: boolean
  multiDimTableModeEnabled: boolean
  documentSemanticMode: string
  documentStructureBaselineLock: boolean
}): ActiveDocumentViewMode {
  if (args.documentStructureBaselineLock === true) return 'documentStructure'
  const semanticMode = normalizeDocumentSemanticMode(args.documentSemanticMode)
  if (semanticMode === 'keyword') return 'keyword'
  if (args.frontmatterModeEnabled === true) return 'frontmatter'
  if (args.multiDimTableModeEnabled === true) return 'multiDimTable'
  return 'documentStructure'
}

export function buildDocumentSemanticModeKey(args: {
  frontmatterModeEnabled: boolean
  multiDimTableModeEnabled: boolean
  documentSemanticMode: string
  documentStructureBaselineLock: boolean
  flowEditorStandalone?: boolean
}): string {
  if (args.flowEditorStandalone === true) return 'flowEditor'
  const activeDocumentViewMode = resolveActiveDocumentViewMode(args)
  if (activeDocumentViewMode === 'keyword') return 'keyword'
  if (activeDocumentViewMode === 'multiDimTable') return 'document:mdtbl'
  return 'document'
}

export function readGraphActiveDocumentViewMode(graphData: { context?: unknown; metadata?: unknown } | null | undefined): ActiveDocumentViewMode | null {
  if (!graphData || typeof graphData !== 'object') return null
  const meta = graphData.metadata && typeof graphData.metadata === 'object' && !Array.isArray(graphData.metadata)
    ? (graphData.metadata as Record<string, unknown>)
    : null
  const rawMode = String(meta?.[ACTIVE_DOCUMENT_VIEW_MODE_META_KEY] || '').trim()
  if (rawMode === 'documentStructure' || rawMode === 'keyword' || rawMode === 'frontmatter' || rawMode === 'multiDimTable') {
    return rawMode
  }
  const context = String(graphData.context || '').trim()
  const kind = String(meta?.kind || '').trim()
  if (kind === 'keyword') return 'keyword'
  if (context === 'frontmatter-flow' || context === 'frontmatter-mermaid' || kind === 'frontmatter-flow') return 'frontmatter'
  return null
}

export function withActiveDocumentViewMode<T extends { metadata?: unknown }>(graphData: T, mode: ActiveDocumentViewMode): T {
  const current = readGraphActiveDocumentViewMode(graphData as { context?: unknown; metadata?: unknown })
  if (current === mode) return graphData
  const meta = graphData.metadata && typeof graphData.metadata === 'object' && !Array.isArray(graphData.metadata)
    ? (graphData.metadata as Record<string, unknown>)
    : {}
  return {
    ...graphData,
    metadata: {
      ...meta,
      [ACTIVE_DOCUMENT_VIEW_MODE_META_KEY]: mode,
    },
  }
}
