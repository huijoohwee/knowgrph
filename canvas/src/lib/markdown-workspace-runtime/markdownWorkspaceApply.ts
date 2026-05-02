import { useGraphStore } from '@/hooks/useGraphStore'
import { extractEmbeddedGeoJsonGraphDataRequests } from '@/lib/markdown/embeddedGeoJson'
import type { MarkdownGeoDatasetIntegration } from '@/features/markdown/ui/MarkdownRendererTypes'

export function resolveMarkdownWorkspaceApplyText(args: {
  activeText: string
  contentMode: 'document' | 'widget'
  widgetEditorText: string
  markdownDocumentName: string
  activeDocumentKey: string
  markdownDocumentText: string
}): string {
  const raw = String(args.activeText || '')
  if (raw.trim()) return raw
  if (args.contentMode === 'widget') return String(args.widgetEditorText || '')
  if (args.markdownDocumentName === args.activeDocumentKey && typeof args.markdownDocumentText === 'string' && args.markdownDocumentText) {
    return args.markdownDocumentText
  }
  return raw
}

export function ensureMarkdownWorkspaceApplyDocumentSemanticMode(): void {
  try {
    const state = useGraphStore.getState()
    if (String(state.documentSemanticMode || 'document') !== 'document') state.setDocumentSemanticMode('document')
  } catch {
    void 0
  }
}

export async function registerMarkdownWorkspaceEmbeddedGeoDatasets(args: {
  markdownText: string
  sourceDocumentPath: string
  geoDatasetIntegration: MarkdownGeoDatasetIntegration
}): Promise<void> {
  const text = String(args.markdownText || '')
  if (!text.includes('```')) return
  const extracted = extractEmbeddedGeoJsonGraphDataRequests({
    markdownText: text,
    sourceDocumentPath: args.sourceDocumentPath,
    limit: 40,
  })
  const geoReqs =
    typeof args.geoDatasetIntegration.isGeoJsonCodeBlock !== 'function'
      ? extracted
      : extracted.filter(req => {
          try {
            return !!args.geoDatasetIntegration.isGeoJsonCodeBlock?.(req)
          } catch {
            return false
          }
        })
  if (geoReqs.length === 0 || typeof args.geoDatasetIntegration.registerGeoJsonFeatureCollection !== 'function') return
  await Promise.all(geoReqs.map(req => args.geoDatasetIntegration.registerGeoJsonFeatureCollection?.(req)))
}
