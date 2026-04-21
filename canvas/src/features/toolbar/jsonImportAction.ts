import { FLOW_WIDGET_REGISTRY_METADATA_KEY, UI_COPY } from '@/lib/config'
import { pickTextFileWithExtensions } from '@/lib/graph/file'
import { normalizeImportName, promptForUrl } from './ingestUtils'
import { fetchRemoteText } from '@/lib/net/fetchRemoteText'
import { coerceHttpUrl, normalizeGitHubBlobLikeUrl } from '@/lib/url'
import { applyLoaderResultToParserUi } from '@/features/toolbar/importUi'
import { applyImportedCsvToStore, applyImportedJsonToStore } from '@/features/toolbar/importSideEffects'
import { runImportFlow } from '@/features/toolbar/importFlow'

export type JsonImportFormat = 'jsonld' | 'json'
export type JsonImportType = 'url' | 'local'

export async function performJsonImport(type: JsonImportType, format: JsonImportFormat, providedUrl?: string) {
  try {
    const picked = await (async (): Promise<{ name: string; text: string; sourceUrl?: string } | null> => {
      if (type === 'url') {
        const rawUrl = (() => {
          const v = typeof providedUrl === 'string' ? providedUrl.trim() : ''
          if (v) return v
          return promptForUrl(UI_COPY.jsonImportUrlPrompt) || ''
        })()
        const url = coerceHttpUrl(rawUrl)
        if (!url) return null
        const fetchUrl = normalizeGitHubBlobLikeUrl(url) ?? url
        const text = await fetchRemoteText(fetchUrl)
        if (!text) {
          applyLoaderResultToParserUi(null, { failureLabelOverride: UI_COPY.jsonImportFetchFailedStatus(url) })
          return null
        }
        const fallback = format === 'jsonld' ? 'remote.jsonld' : 'remote.json'
        const name = normalizeImportName(rawUrl, fallback, 'json', format)
        return { name, text, sourceUrl: url }
      }
      if (type === 'local') {
        const p = await pickTextFileWithExtensions(['.json', '.jsonld', '.geojson'])
        if (!p) return null
        return { ...p, sourceUrl: undefined }
      }
      return null
    })()

    if (!picked) return

    await runImportFlow({
      nameForParse: picked.name,
      textForParse: picked.text,
      ui: { collapsePanelsOnSuccess: true },
      onSuccess: (res) => {
        if (!res.input || !res.input.text.trim()) return
        const rawName = String(res.input.name || '')
        const baseName = rawName.trim() || (format === 'jsonld' ? 'graph.jsonld' : 'graph.json')
        const hasWidgetRegistry = (() => {
          const meta = res.graphData?.metadata
          if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false
          const raw = (meta as Record<string, unknown>)[FLOW_WIDGET_REGISTRY_METADATA_KEY]
          return Array.isArray(raw) && raw.length > 0
        })()

        applyImportedJsonToStore({
          name: baseName,
          text: String(res.input.text || ''),
          fallbackFenceLang: format === 'jsonld' ? 'jsonld' : 'json',
          sourceUrl: type === 'url' ? picked.sourceUrl ?? null : null,
          preferFlowEditor: hasWidgetRegistry,
          applyToGraph: false,
        })
      },
    })
  } catch {
    applyLoaderResultToParserUi(null)
  }
}

export async function performCsvImport() {
  try {
    const picked = await pickTextFileWithExtensions(['.csv'])
    if (!picked) return

    await runImportFlow({
      nameForParse: picked.name,
      textForParse: picked.text,
      openWorkspaceViewMode: 'canvas',
      onSuccess: (res) => {
        if (!res.input || !res.input.text.trim()) return
        const rawName = String(res.input.name || '')
        const baseName = rawName.trim() || 'graph.csv'
        applyImportedCsvToStore({
          name: baseName,
          text: String(res.input.text || ''),
          sourceUrl: null,
        })
      },
    })
  } catch {
    applyLoaderResultToParserUi(null)
  }
}
