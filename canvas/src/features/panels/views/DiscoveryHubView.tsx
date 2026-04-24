import React from 'react'
import { Compass, ExternalLink, MapPin, Search } from 'lucide-react'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import { settingsRegistry } from '@/features/settings/registry'
import type { SettingMeta } from '@/features/settings/types'
import { emitSidePanelOpen } from '@/features/canvas/utils'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

const DISCOVERY_KEYS = [
  'maps.grabmaps.mcp.searchPlaces.query',
  'maps.grabmaps.mcp.searchPlaces.country',
  'maps.grabmaps.mcp.searchPlaces.lat',
  'maps.grabmaps.mcp.searchPlaces.lon',
  'maps.grabmaps.mcp.searchPlaces.limit',
  'maps.grabmaps.mcp.nearbySearch.radius',
  'maps.grabmaps.mcp.nearbySearch.rankBy',
  'maps.grabmaps.mcp.nearbySearch.language',
  'maps.grabmaps.mcp.nearbySearch.category',
] as const

type DiscoveryKey = (typeof DISCOVERY_KEYS)[number]
type DiscoveryDraft = Record<DiscoveryKey, string>

const FIELD_LABELS: Readonly<Record<DiscoveryKey, string>> = {
  'maps.grabmaps.mcp.searchPlaces.query': 'Search Query',
  'maps.grabmaps.mcp.searchPlaces.country': 'Country',
  'maps.grabmaps.mcp.searchPlaces.lat': 'Location Bias Lat',
  'maps.grabmaps.mcp.searchPlaces.lon': 'Location Bias Lon',
  'maps.grabmaps.mcp.searchPlaces.limit': 'Result Limit',
  'maps.grabmaps.mcp.nearbySearch.radius': 'Nearby Radius (km)',
  'maps.grabmaps.mcp.nearbySearch.rankBy': 'Nearby Rank',
  'maps.grabmaps.mcp.nearbySearch.language': 'Language',
  'maps.grabmaps.mcp.nearbySearch.category': 'Category',
}

const FIELD_PLACEHOLDERS: Readonly<Partial<Record<DiscoveryKey, string>>> = {
  'maps.grabmaps.mcp.searchPlaces.query': 'Marina Bay Sands, night markets, waterfront ferries',
  'maps.grabmaps.mcp.searchPlaces.country': 'SGP',
  'maps.grabmaps.mcp.nearbySearch.category': 'restaurant',
}

const INPUT_CLASS = `h-8 text-sm ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.text}`
const CARD_CLASS = `rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`

function getSettingMeta(key: DiscoveryKey): SettingMeta | null {
  return settingsRegistry.find(entry => entry.key === key) || null
}

function readSettingString(key: DiscoveryKey): string {
  const meta = getSettingMeta(key)
  if (!meta) return ''
  try {
    const raw = meta.read()
    if (raw == null) {
      const fallback = meta.default?.()
      return fallback == null ? '' : String(fallback)
    }
    return String(raw)
  } catch {
    const fallback = meta.default?.()
    return fallback == null ? '' : String(fallback)
  }
}

function readDraft(): DiscoveryDraft {
  return {
    'maps.grabmaps.mcp.searchPlaces.query': readSettingString('maps.grabmaps.mcp.searchPlaces.query'),
    'maps.grabmaps.mcp.searchPlaces.country': readSettingString('maps.grabmaps.mcp.searchPlaces.country'),
    'maps.grabmaps.mcp.searchPlaces.lat': readSettingString('maps.grabmaps.mcp.searchPlaces.lat'),
    'maps.grabmaps.mcp.searchPlaces.lon': readSettingString('maps.grabmaps.mcp.searchPlaces.lon'),
    'maps.grabmaps.mcp.searchPlaces.limit': readSettingString('maps.grabmaps.mcp.searchPlaces.limit'),
    'maps.grabmaps.mcp.nearbySearch.radius': readSettingString('maps.grabmaps.mcp.nearbySearch.radius'),
    'maps.grabmaps.mcp.nearbySearch.rankBy': readSettingString('maps.grabmaps.mcp.nearbySearch.rankBy'),
    'maps.grabmaps.mcp.nearbySearch.language': readSettingString('maps.grabmaps.mcp.nearbySearch.language'),
    'maps.grabmaps.mcp.nearbySearch.category': readSettingString('maps.grabmaps.mcp.nearbySearch.category'),
  }
}

function readDefaults(): DiscoveryDraft {
  const next = {} as DiscoveryDraft
  for (const key of DISCOVERY_KEYS) {
    const meta = getSettingMeta(key)
    const fallback = meta?.default?.()
    next[key] = fallback == null ? '' : String(fallback)
  }
  return next
}

function writeDraft(draft: DiscoveryDraft): void {
  for (const key of DISCOVERY_KEYS) {
    const meta = getSettingMeta(key)
    if (!meta?.write) continue
    const raw = draft[key]
    meta.write(meta.type === 'number' ? Number(raw) : raw)
  }
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

export default function DiscoveryHubView({
  searchQuery = '',
  onRegisterActions,
}: {
  searchQuery?: string
  requestedAnchorId?: string
  requestedAnchorSeq?: number
  onRegisterActions?: (a: {
    apply: () => void
    reset: () => void
    applyDisabled?: boolean
    resetDisabled?: boolean
    globalReset?: () => void
    collapseAll?: () => void
    expandAll?: () => void
    allCollapsed?: boolean
  }) => void
}) {
  const [baseline, setBaseline] = React.useState<DiscoveryDraft>(() => readDraft())
  const [draft, setDraft] = React.useState<DiscoveryDraft>(() => readDraft())

  React.useEffect(() => {
    const next = readDraft()
    setBaseline(next)
    setDraft(prev => (
      searchQuery.trim().length > 0 && prev['maps.grabmaps.mcp.searchPlaces.query'] === baseline['maps.grabmaps.mcp.searchPlaces.query']
        ? { ...next, 'maps.grabmaps.mcp.searchPlaces.query': searchQuery.trim() }
        : next
    ))
    // baseline is intentionally omitted here so external query changes can seed the search box without churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  const dirty = DISCOVERY_KEYS.some(key => draft[key] !== baseline[key])

  const apply = React.useCallback(() => {
    writeDraft(draft)
    const next = readDraft()
    setBaseline(next)
    setDraft(next)
  }, [draft])

  const reset = React.useCallback(() => {
    setDraft(baseline)
  }, [baseline])

  const restoreDefaults = React.useCallback(() => {
    const defaults = readDefaults()
    writeDraft(defaults)
    const next = readDraft()
    setBaseline(next)
    setDraft(next)
  }, [])

  React.useEffect(() => {
    onRegisterActions?.({
      apply,
      reset,
      globalReset: restoreDefaults,
      applyDisabled: !dirty,
      resetDisabled: !dirty,
    })
  }, [apply, dirty, onRegisterActions, reset, restoreDefaults])

  const keywordSearchPreview = React.useMemo(() => {
    const params = new URLSearchParams({
      keyword: draft['maps.grabmaps.mcp.searchPlaces.query'],
      country: draft['maps.grabmaps.mcp.searchPlaces.country'],
      location: `${draft['maps.grabmaps.mcp.searchPlaces.lat']},${draft['maps.grabmaps.mcp.searchPlaces.lon']}`,
      limit: draft['maps.grabmaps.mcp.searchPlaces.limit'],
    })
    return `https://maps.grab.com/api/v1/maps/poi/v1/search?${params.toString()}`
  }, [draft])

  const nearbyPreview = React.useMemo(() => {
    const params = new URLSearchParams({
      location: `${draft['maps.grabmaps.mcp.searchPlaces.lat']},${draft['maps.grabmaps.mcp.searchPlaces.lon']}`,
      radius: draft['maps.grabmaps.mcp.nearbySearch.radius'],
      limit: draft['maps.grabmaps.mcp.searchPlaces.limit'],
      rankBy: draft['maps.grabmaps.mcp.nearbySearch.rankBy'],
      language: draft['maps.grabmaps.mcp.nearbySearch.language'],
    })
    const category = draft['maps.grabmaps.mcp.nearbySearch.category'].trim()
    if (category) params.set('category_hint', category)
    return `https://maps.grab.com/api/v1/maps/place/v2/nearby?${params.toString()}`
  }, [draft])

  const setField = React.useCallback((key: DiscoveryKey, value: string) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }, [])

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 overflow-auto px-3 py-3" aria-label="Discovery hub">
      <section className={`${CARD_CLASS} p-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4" aria-hidden="true" />
              <h2 className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>Discovery</h2>
            </div>
            <p className={`mt-2 text-sm ${UI_THEME_TOKENS.text.secondary}`}>
              User-facing place search and discovery for GrabMaps. MainPanel Maps remains backend/system/API/MCP-facing.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`inline-flex h-8 items-center gap-1 rounded border px-2 text-sm ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}
              onClick={() => emitSidePanelOpen({ tab: 'geo', open: true })}
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Open Geo
            </button>
            <button
              type="button"
              className={`inline-flex h-8 items-center gap-1 rounded border px-2 text-sm ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}
              onClick={() => openMainPanelMaps('GrabMaps MCP Configuration')}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open MainPanel Maps
            </button>
          </div>
        </div>
      </section>

      <section className={`${CARD_CLASS} p-3`}>
        <label className={`mb-2 flex items-center gap-2 font-medium ${UI_THEME_TOKENS.text.primary}`} htmlFor="grabmaps-discovery-query">
          <Search className="h-4 w-4" aria-hidden="true" />
          Search Places
        </label>
        <PlainTextInputEditor
          id="grabmaps-discovery-query"
          value={draft['maps.grabmaps.mcp.searchPlaces.query']}
          onChange={next => setField('maps.grabmaps.mcp.searchPlaces.query', next)}
          placeholder={FIELD_PLACEHOLDERS['maps.grabmaps.mcp.searchPlaces.query']}
          className={INPUT_CLASS}
          ariaLabel="Search Query"
        />
        <p className={`mt-2 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
          Search and discover places with a user-facing query box here. Raw MCP command, args, env, and startup timeout stay in MainPanel Maps.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <section className={`${CARD_CLASS} p-3`}>
          <h3 className={`font-medium ${UI_THEME_TOKENS.text.primary}`}>Keyword Search Defaults</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([
              'maps.grabmaps.mcp.searchPlaces.country',
              'maps.grabmaps.mcp.searchPlaces.lat',
              'maps.grabmaps.mcp.searchPlaces.lon',
              'maps.grabmaps.mcp.searchPlaces.limit',
            ] as const).map(key => (
              <label key={key} className="flex min-w-0 flex-col gap-1 text-sm">
                <span className={UI_THEME_TOKENS.text.secondary}>{FIELD_LABELS[key]}</span>
                <PlainTextInputEditor
                  value={draft[key]}
                  onChange={next => setField(key, next)}
                  placeholder={FIELD_PLACEHOLDERS[key]}
                  className={INPUT_CLASS}
                  ariaLabel={FIELD_LABELS[key]}
                />
              </label>
            ))}
          </div>
          <div className={`mt-3 rounded border p-2 text-xs ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}>
            <div className="font-medium">Keyword Search Preview</div>
            <div className="mt-1 break-all">{keywordSearchPreview}</div>
          </div>
        </section>

        <section className={`${CARD_CLASS} p-3`}>
          <h3 className={`font-medium ${UI_THEME_TOKENS.text.primary}`}>Nearby Discovery Defaults</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([
              'maps.grabmaps.mcp.nearbySearch.radius',
              'maps.grabmaps.mcp.nearbySearch.rankBy',
              'maps.grabmaps.mcp.nearbySearch.language',
              'maps.grabmaps.mcp.nearbySearch.category',
            ] as const).map(key => (
              <label key={key} className="flex min-w-0 flex-col gap-1 text-sm">
                <span className={UI_THEME_TOKENS.text.secondary}>{FIELD_LABELS[key]}</span>
                <PlainTextInputEditor
                  value={draft[key]}
                  onChange={next => setField(key, next)}
                  placeholder={FIELD_PLACEHOLDERS[key]}
                  className={INPUT_CLASS}
                  ariaLabel={FIELD_LABELS[key]}
                />
              </label>
            ))}
          </div>
          <div className={`mt-3 rounded border p-2 text-xs ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}>
            <div className="font-medium">Nearby Search Preview</div>
            <div className="mt-1 break-all">{nearbyPreview}</div>
          </div>
        </section>
      </section>

      <section className={`${CARD_CLASS} p-3`}>
        <h3 className={`font-medium ${UI_THEME_TOKENS.text.primary}`}>MainPanel Maps Integration</h3>
        <ul className={`mt-2 space-y-1 text-sm ${UI_THEME_TOKENS.text.secondary}`}>
          <li>MainPanel Maps keeps backend/system/API/MCP-facing config, including server key, command, args, env, and startup timeout.</li>
          <li>Discovery stays user-facing and writes to the same shared GrabMaps search defaults used by the backend-facing Maps surface.</li>
          <li>Use the floating header Apply/Reset actions to commit or discard discovery changes without adding a second persistence path.</li>
        </ul>
      </section>
    </section>
  )
}
