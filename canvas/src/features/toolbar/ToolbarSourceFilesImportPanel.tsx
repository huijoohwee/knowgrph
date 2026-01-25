import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import { pickTextFilesWithExtensions } from '@/lib/graph/file'
import { deriveFilenameFromUrl, normalizeGitHubBlobLikeUrl, splitUserProvidedTextList } from '@/lib/url'
import { fetchRemoteText } from '@/lib/net/fetchRemoteText'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { GeospatialDatasetsManager } from 'gympgrph/datasets-ui'

type GeoDatasetFormat = 'auto' | 'geojson' | 'records'

export function ToolbarSourceFilesImportPanel() {
  const addSourceFile = useGraphStore(s => s.addSourceFile)
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')

  const [label, setLabel] = React.useState('')
  const [urlsText, setUrlsText] = React.useState('')
  const [alsoAddGeoLayer, setAlsoAddGeoLayer] = React.useState(false)
  const [geoLayerFormat, setGeoLayerFormat] = React.useState<GeoDatasetFormat>('auto')
  const [isBusy, setIsBusy] = React.useState(false)

  const buttonBase = `App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`

  const urls = React.useMemo(() => {
    const list = splitUserProvidedTextList(urlsText)
    return list.map(u => normalizeGitHubBlobLikeUrl(u) || u)
  }, [urlsText])

  const handleAddUrls = async () => {
    if (!urls || urls.length === 0) return

    const isSingle = urls.length === 1
    const resolved = urls.map(u => ({
      url: u,
      name: (() => {
        const trimmed = label.trim()
        if (isSingle && trimmed) return trimmed
        const derived = deriveFilenameFromUrl(u, 'source.txt')
        return derived || u
      })(),
    }))

    setIsBusy(true)
    try {
      for (const item of resolved) {
        const text = await fetchRemoteText(item.url)
        if (!text) continue
        addSourceFile({
          id: crypto.randomUUID(),
          name: item.name,
          text,
          enabled: true,
          status: 'idle',
        })
      }

      if (alsoAddGeoLayer) {
        try {
          const m = await import('gympgrph/datasets')
          m.addGeospatialDatasetUrls(
            resolved.map(item => ({
              label: item.name,
              url: item.url,
              format: geoLayerFormat,
            })),
          )
        } catch {
          void 0
        }
      }

      setLabel('')
      setUrlsText('')
    } finally {
      setIsBusy(false)
    }
  }

  const handleAddLocalFiles = async () => {
    setIsBusy(true)
    try {
      const files = await pickTextFilesWithExtensions([
        '.md',
        '.markdown',
        '.txt',
        '.json',
        '.jsonld',
        '.csv',
        '.html',
        '.htm',
        '.yaml',
        '.yml',
      ])
      for (const f of files) {
        addSourceFile({
          id: crypto.randomUUID(),
          name: f.name,
          text: f.text,
          enabled: true,
          status: 'idle',
        })
      }
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-1">
      <section className="grid grid-cols-1 gap-2" aria-label={UI_COPY.sourceFilesImportPanelAriaLabel}>
        <input
          className={`w-full ${uiPanelKeyValueTextSizeClass} rounded border px-2 py-1 ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} ${uiPanelTextFontClass}`}
          placeholder={UI_COPY.sourceFilesImportLabelPlaceholder}
          value={label}
          onChange={e => setLabel(e.target.value)}
          disabled={isBusy}
        />
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void handleAddUrls()
          }}
        >
          <textarea
            className={`flex-1 ${uiPanelKeyValueTextSizeClass} rounded border px-2 py-1 ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} ${uiPanelTextFontClass} resize-y min-h-[34px]`}
            placeholder={UI_COPY.sourceFilesImportUrlsPlaceholder}
            value={urlsText}
            onChange={e => setUrlsText(e.target.value)}
            disabled={isBusy}
            rows={1}
          />
          <button
            type="submit"
            className={`${buttonBase} px-2 py-1 ${urls.length === 0 || isBusy ? UI_THEME_TOKENS.button.disabledText : ''}`}
            disabled={urls.length === 0 || isBusy}
          >
            {UI_COPY.sourceFilesImportAddUrlsButtonLabel}
          </button>

          <button
            type="button"
            className={`${buttonBase} px-2 py-1 ${isBusy ? UI_THEME_TOKENS.button.disabledText : ''}`}
            onClick={() => void handleAddLocalFiles()}
            disabled={isBusy}
          >
            {UI_COPY.sourceFilesImportAddLocalFilesButtonLabel}
          </button>
        </form>

        <div className={`flex items-center justify-between gap-2 ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass}`}>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={alsoAddGeoLayer}
              onChange={e => setAlsoAddGeoLayer(e.target.checked)}
              disabled={isBusy}
            />
            <span className={UI_THEME_TOKENS.text.secondary}>{UI_COPY.sourceFilesImportAlsoAddGeoLayerLabel}</span>
          </label>

          <label className="inline-flex items-center gap-2">
            <span className={UI_THEME_TOKENS.text.secondary}>{UI_COPY.sourceFilesImportGeoLayerFormatLabel}</span>
            <select
              className={`rounded border px-2 py-1 ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`}
              value={geoLayerFormat}
              onChange={e => setGeoLayerFormat(e.target.value as GeoDatasetFormat)}
              disabled={isBusy || !alsoAddGeoLayer}
            >
              <option value="auto">auto</option>
              <option value="geojson">geojson</option>
              <option value="records">records</option>
            </select>
          </label>
        </div>
      </section>

      <GeospatialDatasetsManager showAdd={true} />
    </div>
  )
}
