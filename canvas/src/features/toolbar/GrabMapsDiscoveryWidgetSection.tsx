import React from 'react'
import { Compass, ExternalLink, Search } from 'lucide-react'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { fetchRemoteTextDetailed } from '@/lib/net/fetchRemoteText'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  type DiscoveryPropertyKey,
  getGrabMapsDiscoveryWidgetLabel,
  readGrabMapsDiscoveryDefaultSettingsValues,
  readGrabMapsDiscoverySettingsValues,
} from '@/features/flow-editor-manager/grabMapsDiscoveryWidget'
import type { GrabMapsDiscoverySettingsValues } from '@/features/flow-editor-manager/grabMapsDiscoveryWidget'
import { writeGrabMapsDiscoverySettingsValues } from '@/features/flow-editor-manager/grabMapsDiscoveryWidget'
import { GrabMapsDiscoverySettingsTable } from '@/features/toolbar/grabMapsDiscoveryRows'
import { GRABMAPS_DISCOVERY_FIELD_META } from '@/features/flow-editor-manager/grabMapsDiscoveryWidget'

type DiscoveryResultItem = {
  id: string
  title: string
  subtitle: string
  coordinates: string
}

const INPUT_CLASS = `h-8 text-sm ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.text}`
const CARD_CLASS = `rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`

function readText(properties: DiscoveryWidgetProperties, key: DiscoveryPropertyKey): string {
  const value = properties[key]
  return typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

type DiscoveryWidgetProperties = Record<DiscoveryPropertyKey, unknown>

function settingsValuesToProperties(values: GrabMapsDiscoverySettingsValues): DiscoveryWidgetProperties {
  const next = {} as DiscoveryWidgetProperties
  for (const field of GRABMAPS_DISCOVERY_FIELD_META) {
    next[field.propertyKey] = values[field.settingKey]
  }
  return next
}

function openMainPanelMaps(searchQuery: string): void {
  if (typeof window === 'undefined') return
  try {
    const CustomEventCtor = typeof window.CustomEvent === 'function' ? window.CustomEvent : CustomEvent
    window.dispatchEvent(new CustomEventCtor(MAIN_PANEL_OPEN_EVENT, {
      detail: {
        tab: 'maps',
        searchQuery,
      },
    }))
  } catch {
    void 0
  }
}

function buildGrabMapsAuthHeader(apiKey: string): string {
  const raw = String(apiKey || '').trim()
  if (!raw) return ''
  return /^bearer\s+/i.test(raw) ? raw : `Bearer ${raw}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function toArrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function pickRecordArray(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value)) return []
  const candidates = [
    value.results,
    value.items,
    value.places,
    value.pois,
    value.data,
    isRecord(value.data) ? value.data.results : null,
    isRecord(value.data) ? value.data.items : null,
    isRecord(value.data) ? value.data.places : null,
    isRecord(value.data) ? value.data.pois : null,
  ]
  for (const candidate of candidates) {
    const next = toArrayOfRecords(candidate)
    if (next.length > 0) return next
  }
  for (const nested of Object.values(value)) {
    const next = toArrayOfRecords(nested)
    if (next.length > 0) return next
  }
  return []
}

function readCoordinate(item: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const direct = item[key]
    if (typeof direct === 'number' && Number.isFinite(direct)) return direct
    if (typeof direct === 'string' && direct.trim()) {
      const parsed = Number(direct)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  const location = isRecord(item.location) ? item.location : null
  if (!location) return null
  for (const key of keys) {
    const nested = location[key]
    if (typeof nested === 'number' && Number.isFinite(nested)) return nested
    if (typeof nested === 'string' && nested.trim()) {
      const parsed = Number(nested)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function normalizePlaceResult(item: Record<string, unknown>, index: number): DiscoveryResultItem {
  const title = [
    item.name,
    item.title,
    item.display_name,
    item.poi_name,
    item.id,
  ].map(value => String(value || '').trim()).find(Boolean) || `Place ${index + 1}`
  const subtitle = [
    item.address,
    item.formatted_address,
    item.vicinity,
    item.category,
    item.primary_category,
  ].map(value => String(value || '').trim()).find(Boolean) || 'No address details returned.'
  const lat = readCoordinate(item, ['lat', 'latitude'])
  const lon = readCoordinate(item, ['lon', 'lng', 'longitude'])
  return {
    id: String(item.id || `${title}:${index}`),
    title,
    subtitle,
    coordinates: lat != null && lon != null ? `${lat}, ${lon}` : '',
  }
}

function extractPlaceResults(text: string): DiscoveryResultItem[] {
  try {
    const parsed = JSON.parse(text) as unknown
    return pickRecordArray(parsed).slice(0, 8).map(normalizePlaceResult)
  } catch {
    return []
  }
}

export function GrabMapsDiscoveryWidgetSection(): React.ReactElement {
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelMicroLabelTextSizeClass = useGraphStore(s => s.uiPanelMicroLabelTextSizeClass || 'text-[10px]')
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass
      || `w-full h-6 px-2 text-xs ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} rounded text-right`,
  )
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const grabMapsAuthMode = useGraphStore(s => s.grabMapsAuthMode)
  const grabMapsApiKey = useGraphStore(s => s.grabMapsApiKey)
  const [settingsValues, setSettingsValues] = React.useState<GrabMapsDiscoverySettingsValues>(() => readGrabMapsDiscoverySettingsValues())
  const [keywordStatus, setKeywordStatus] = React.useState<string | null>(null)
  const [keywordResults, setKeywordResults] = React.useState<DiscoveryResultItem[]>([])
  const [nearbyStatus, setNearbyStatus] = React.useState<string | null>(null)
  const [nearbyResults, setNearbyResults] = React.useState<DiscoveryResultItem[]>([])
  const [runningAction, setRunningAction] = React.useState<'keyword' | 'nearby' | null>(null)
  const dirtyRef = React.useRef<Set<string>>(new Set())
  const settingsTypeIconSizeClass = uiIconScale === 'compact' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  const properties = React.useMemo(
    () => settingsValuesToProperties(settingsValues),
    [settingsValues],
  )

  const keywordSearchPreview = React.useMemo(() => {
    const params = new URLSearchParams()
    const query = readText(properties, 'searchQuery')
    const country = readText(properties, 'searchCountry')
    const lat = readText(properties, 'searchLat')
    const lon = readText(properties, 'searchLon')
    const limit = readText(properties, 'searchLimit')
    if (query) params.set('keyword', query)
    if (country) params.set('country', country)
    if (lat && lon) params.set('location', `${lat},${lon}`)
    if (limit) params.set('limit', limit)
    return `https://maps.grab.com/api/v1/maps/poi/v1/search?${params.toString()}`
  }, [properties])

  const nearbyPreview = React.useMemo(() => {
    const params = new URLSearchParams()
    const lat = readText(properties, 'nearbyLat')
    const lon = readText(properties, 'nearbyLon')
    const radius = readText(properties, 'nearbyRadiusKm')
    const limit = readText(properties, 'nearbyLimit')
    const rankBy = readText(properties, 'nearbyRankBy')
    const language = readText(properties, 'nearbyLanguage')
    const category = readText(properties, 'nearbyCategory')
    if (lat && lon) params.set('location', `${lat},${lon}`)
    if (radius) params.set('radius', radius)
    if (limit) params.set('limit', limit)
    if (rankBy) params.set('rankBy', rankBy)
    if (language) params.set('language', language)
    if (category) params.set('category_hint', category)
    return `https://maps.grab.com/api/v1/maps/place/v2/nearby?${params.toString()}`
  }, [properties])

  const keywordSearchSummary = React.useMemo(() => {
    const query = readText(properties, 'searchQuery') || 'places'
    const country = readText(properties, 'searchCountry')
    const lat = readText(properties, 'searchLat')
    const lon = readText(properties, 'searchLon')
    const limit = readText(properties, 'searchLimit')
    return [
      `Keyword: ${query}`,
      country ? `Country: ${country}` : '',
      lat && lon ? `Bias: ${lat}, ${lon}` : '',
      limit ? `Limit: ${limit}` : '',
    ].filter(Boolean).join(' | ')
  }, [properties])

  const nearbySearchSummary = React.useMemo(() => {
    const lat = readText(properties, 'nearbyLat')
    const lon = readText(properties, 'nearbyLon')
    const radius = readText(properties, 'nearbyRadiusKm')
    const limit = readText(properties, 'nearbyLimit')
    const rankBy = readText(properties, 'nearbyRankBy')
    const language = readText(properties, 'nearbyLanguage')
    const category = readText(properties, 'nearbyCategory')
    return [
      category ? `Category: ${category}` : 'Category: places',
      lat && lon ? `Anchor: ${lat}, ${lon}` : '',
      radius ? `Radius: ${radius} km` : '',
      limit ? `Limit: ${limit}` : '',
      rankBy ? `Rank: ${rankBy}` : '',
      language ? `Language: ${language}` : '',
    ].filter(Boolean).join(' | ')
  }, [properties])

  const commitSettingsValues = React.useCallback((updater: React.SetStateAction<GrabMapsDiscoverySettingsValues>) => {
    setSettingsValues(prev => {
      const next = typeof updater === 'function'
        ? (updater as (prevState: GrabMapsDiscoverySettingsValues) => GrabMapsDiscoverySettingsValues)(prev)
        : updater
      writeGrabMapsDiscoverySettingsValues(next)
      return next
    })
  }, [])

  const restoreDefaults = React.useCallback(() => {
    const defaults = readGrabMapsDiscoveryDefaultSettingsValues()
    commitSettingsValues(defaults)
    setKeywordStatus('Discovery widget defaults restored.')
    setNearbyStatus('Discovery widget defaults restored.')
    setKeywordResults([])
    setNearbyResults([])
  }, [commitSettingsValues])

  const runRequest = React.useCallback(async (kind: 'keyword' | 'nearby') => {
    const requestUrl = kind === 'keyword' ? keywordSearchPreview : nearbyPreview
    const setStatus = kind === 'keyword' ? setKeywordStatus : setNearbyStatus
    const setResults = kind === 'keyword' ? setKeywordResults : setNearbyResults
    writeGrabMapsDiscoverySettingsValues(settingsValues)
    setRunningAction(kind)
    setStatus('Running GrabMaps discovery widget...')
    setResults([])
    try {
      if (grabMapsAuthMode !== 'byok') {
        setStatus('Direct Discovery Widget fetch needs GrabMaps BYOK auth in MainPanel Maps.')
        return
      }
      const authHeader = buildGrabMapsAuthHeader(grabMapsApiKey)
      if (!authHeader) {
        setStatus('Enter a GrabMaps API key in MainPanel Maps before running Discovery Widget search.')
        return
      }
      const response = await fetchRemoteTextDetailed(requestUrl, {
        useProxy: 'always',
        preflightHead: false,
        maxBytes: 300_000,
        headers: {
          Accept: 'application/json',
          Authorization: authHeader,
        },
      })
      if ('kind' in response) {
        setStatus(`GrabMaps request failed: ${response.kind}`)
        return
      }
      const results = extractPlaceResults(response.text)
      if (results.length === 0) {
        setStatus('GrabMaps returned no place list for this query.')
        return
      }
      setResults(results)
      setStatus(`Found ${results.length} place result${results.length === 1 ? '' : 's'}.`)
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '').trim()
          : ''
      setStatus(`GrabMaps request failed: ${message || 'Unknown error'}`)
    } finally {
      setRunningAction(current => (current === kind ? null : current))
    }
  }, [grabMapsApiKey, grabMapsAuthMode, keywordSearchPreview, nearbyPreview, properties, settingsValues])

  return (
    <section className="px-3 py-2 space-y-3" aria-label="Discovery Widget">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4" aria-hidden="true" />
            <h3 className={`font-semibold ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.primary}`}>
              Discovery Widget
            </h3>
          </div>
          <p className={`mt-2 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>
            Props Panel owns the user-facing Discovery Widget. MainPanel Maps stays backend/system/API/MCP-facing for GrabMaps.
          </p>
        </div>
        <button
          type="button"
          className={`inline-flex h-8 items-center gap-1 rounded border px-2 text-sm ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}
          onClick={() => openMainPanelMaps('GrabMaps MCP Configuration')}
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Open MainPanel Maps
        </button>
      </div>

      <section className={`${CARD_CLASS} p-3`} aria-label="Discovery Widget Identity">
        <div className={`font-medium ${UI_THEME_TOKENS.text.primary}`}>{getGrabMapsDiscoveryWidgetLabel()}</div>
        <div className={`mt-1 ${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>
          Drag this widget from the shared Widget palette into the canvas, aligned with the same palette/drop SSOT used by OpenAI Text Widget.
        </div>
      </section>

      <GrabMapsDiscoverySettingsTable
        ariaLabel="GrabMaps keyword discovery settings"
        section="keyword"
        microLabelClass={uiPanelMicroLabelTextSizeClass}
        textSizeClass={uiPanelKeyValueTextSizeClass}
        keyLabelClass={`${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass}`}
        values={settingsValues}
        setValues={commitSettingsValues}
        dirtyRef={dirtyRef}
        settingsTypeIconSizeClass={settingsTypeIconSizeClass}
        uiIconStrokeWidth={typeof uiIconStrokeWidth === 'number' && Number.isFinite(uiIconStrokeWidth) ? uiIconStrokeWidth : 1.5}
      />

      <section className={`${CARD_CLASS} p-3`}>
        <label className={`mb-2 flex items-center gap-2 font-medium ${UI_THEME_TOKENS.text.primary}`} htmlFor="grabmaps-discovery-widget-query">
          <Search className="h-4 w-4" aria-hidden="true" />
          Search Places
        </label>
        <PlainTextInputEditor
          id="grabmaps-discovery-widget-query"
          value={readText(properties, 'searchQuery')}
          onChange={next => {
            commitSettingsValues(prev => ({
              ...prev,
              'maps.grabmaps.mcp.searchPlaces.query': next,
            }))
          }}
          placeholder="Marina Bay Sands, night markets, waterfront ferries"
          className={INPUT_CLASS}
          ariaLabel="Search Query"
        />
        <p className={`mt-2 ${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>
          Widget rows reuse the shared widget registry and port-handle key/type/value layout, while discovery defaults stay on the shared GrabMaps settings keys.
        </p>
      </section>

      <GrabMapsDiscoverySettingsTable
        ariaLabel="GrabMaps nearby discovery settings"
        section="nearby"
        microLabelClass={uiPanelMicroLabelTextSizeClass}
        textSizeClass={uiPanelKeyValueTextSizeClass}
        keyLabelClass={`${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass}`}
        values={settingsValues}
        setValues={commitSettingsValues}
        dirtyRef={dirtyRef}
        settingsTypeIconSizeClass={settingsTypeIconSizeClass}
        uiIconStrokeWidth={typeof uiIconStrokeWidth === 'number' && Number.isFinite(uiIconStrokeWidth) ? uiIconStrokeWidth : 1.5}
      />

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <section className={`${CARD_CLASS} p-3`}>
          <h4 className={`font-medium ${UI_THEME_TOKENS.text.primary}`}>Keyword Search Summary</h4>
          <div className={`mt-2 rounded border p-2 text-xs ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}>
            <div className="break-all">{keywordSearchSummary}</div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`inline-flex h-8 items-center gap-1 rounded border px-2 text-sm ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}
              onClick={() => void runRequest('keyword')}
              disabled={runningAction != null}
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              {runningAction === 'keyword' ? 'Searching...' : 'Search Places'}
            </button>
          </div>
          {keywordStatus ? (
            <p className={`mt-2 text-xs ${UI_THEME_TOKENS.text.secondary}`}>{keywordStatus}</p>
          ) : null}
          {keywordResults.length > 0 ? (
            <div className="mt-3 space-y-2" aria-label="Keyword discovery results">
              {keywordResults.map(result => (
                <article key={result.id} className={`rounded border p-2 text-sm ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg}`}>
                  <div className={UI_THEME_TOKENS.text.primary}>{result.title}</div>
                  <div className={`mt-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>{result.subtitle}</div>
                  {result.coordinates ? (
                    <div className={`mt-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>{result.coordinates}</div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <section className={`${CARD_CLASS} p-3`}>
          <h4 className={`font-medium ${UI_THEME_TOKENS.text.primary}`}>Nearby Search Summary</h4>
          <div className={`mt-2 rounded border p-2 text-xs ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}>
            <div className="break-all">{nearbySearchSummary}</div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`inline-flex h-8 items-center gap-1 rounded border px-2 text-sm ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}
              onClick={() => void runRequest('nearby')}
              disabled={runningAction != null}
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              {runningAction === 'nearby' ? 'Discovering...' : 'Discover Nearby'}
            </button>
          </div>
          {nearbyStatus ? (
            <p className={`mt-2 text-xs ${UI_THEME_TOKENS.text.secondary}`}>{nearbyStatus}</p>
          ) : null}
          {nearbyResults.length > 0 ? (
            <div className="mt-3 space-y-2" aria-label="Nearby discovery results">
              {nearbyResults.map(result => (
                <article key={result.id} className={`rounded border p-2 text-sm ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg}`}>
                  <div className={UI_THEME_TOKENS.text.primary}>{result.title}</div>
                  <div className={`mt-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>{result.subtitle}</div>
                  {result.coordinates ? (
                    <div className={`mt-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>{result.coordinates}</div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </section>

      <section className={`${CARD_CLASS} p-3`}>
        <h4 className={`font-medium ${UI_THEME_TOKENS.text.primary}`}>MainPanel Maps Integration</h4>
        <ul className={`mt-2 space-y-1 text-sm ${UI_THEME_TOKENS.text.secondary}`}>
          <li>MainPanel Maps keeps backend/system/API/MCP-facing GrabMaps config, including auth, command, args, env, and startup timeout.</li>
          <li>Discovery Widget writes to the same shared GrabMaps search defaults reused by MainPanel Maps.</li>
          <li>Search runs from Props Panel without a duplicate floating Discovery surface.</li>
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`inline-flex h-8 items-center gap-1 rounded border px-2 text-sm ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}
            onClick={restoreDefaults}
          >
            Restore Discovery Widget Defaults
          </button>
        </div>
      </section>
    </section>
  )
}
