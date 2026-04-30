import React from 'react'
import type { GeospatialViewMode } from 'grph-shared/geospatial/events'
import { GEOSPATIAL_STYLE_URL_CHANGED_EVENT } from 'grph-shared/geospatial/constants'
import { UI_THEME_TOKENS } from 'grph-shared/ui/themeTokens'
import { requestGeospatialCurrentLocation, requestGeospatialFitToData, requestGeospatialFitToSelection } from './geospatialFit.js'
import { LS_KEYS } from './lib/config.js'
import { useGympgrphStore } from './store.js'
import {
  GRABMAPS_DEFAULT_STYLE_URL,
  MAPLIBRE_CLASSIC_DEFAULT_STYLE_URL,
  MAPLIBRE_MODERN_DEFAULT_STYLE_URL,
  MAPLIBRE_GLOBE_DEFAULT_STYLE_URL,
  getBuiltInDefaultStyleUrl,
  isGrabMapsPresetActive,
  isGrabMapsStyleUrl,
  normalizePersistedGeospatialStyleUrl,
  normalizeGeospatialViewMode,
  resolveStandardViewModeStyleUrl,
  SAFE_SVG_FALLBACK_STYLE_SENTINEL,
} from './features/geospatial/basemapStyle.js'
import {
  MAIN_PANEL_DEFAULT_GEOSPATIAL_POINT_STYLE_CONFIG,
  normalizeGeospatialPointStyleConfig,
  readGeospatialPointStyleConfig,
  type GeospatialPointStyleConfig,
  writeGeospatialPointStyleConfig,
} from './features/geospatial/pointStyleConfig.js'

type GeospatialPanelHostProps = {
  active?: boolean
  showDatasetsManager?: boolean
  panelTypography?: unknown
  snapshot?: unknown
  handlers?: unknown
}

const MAPLIBRE_DEFAULT_STYLE_URL = MAPLIBRE_CLASSIC_DEFAULT_STYLE_URL
const GEOSPATIAL_COMMIT_DEBOUNCE_MS = 120

const readPreferredGrabMapsStyleUrl = (): string => {
  return readLsString(LS_KEYS.grabMapsBasemapStyleUrl, GRABMAPS_DEFAULT_STYLE_URL)
}

const persistPreferredGrabMapsStyleUrl = (styleUrl: string): void => {
  if (!isGrabMapsStyleUrl(styleUrl)) return
  writeLsString(LS_KEYS.grabMapsBasemapStyleUrl, styleUrl)
}

type GeoViewModeChoiceProps = {
  active: boolean
  label: string
  detail: string
  onClick: () => void
  disabled: boolean
}

function GeoViewModeChoice(props: GeoViewModeChoiceProps): React.ReactElement {
  const { active, label, detail, onClick, disabled } = props
  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        'relative min-w-0 rounded border px-3 py-3 text-left transition-colors',
        'flex flex-col items-start justify-start gap-1',
        active
          ? [UI_THEME_TOKENS.button.activeBorder, UI_THEME_TOKENS.button.activeBg].join(' ')
          : UI_THEME_TOKENS.panel.border,
        UI_THEME_TOKENS.button.hoverBg,
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
      onClick={onClick}
      aria-pressed={active}
    >
      {active ? (
        <span className="absolute right-2 top-2">
          <svg viewBox="0 0 16 16" aria-hidden="true" className={['w-3 h-3', UI_THEME_TOKENS.button.activeText].join(' ')}>
            <path d="M6.4 11.2L3.2 8l1.2-1.2 2 2 5.2-5.2L12.8 4z" fill="currentColor" />
          </svg>
        </span>
      ) : null}
      <span className={['text-sm font-medium', active ? UI_THEME_TOKENS.button.activeText : UI_THEME_TOKENS.text.primary].join(' ')}>
        {label}
      </span>
      <span className={['text-[11px]', active ? UI_THEME_TOKENS.button.activeText : UI_THEME_TOKENS.text.secondary].join(' ')}>
        {detail}
      </span>
    </button>
  )
}

const readLsString = (key: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback
  try {
    const v = window.localStorage.getItem(key)
    if (v == null) return fallback
    if (key === LS_KEYS.geospatialStyleUrl) {
      const normalized = normalizePersistedGeospatialStyleUrl(v)
      return normalized || fallback
    }
    return String(v)
  } catch {
    return fallback
  }
}

const writeLsString = (key: string, value: string): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    void 0
  }
}

export function GeospatialPanelHost(props: GeospatialPanelHostProps): React.ReactElement {
  const active = props.active !== false
  const disabled = !active
  const geospatialViewMode = useGympgrphStore(s => s.geospatialViewMode)
  const geospatialAutoFitEnabled = useGympgrphStore(s => s.geospatialAutoFitEnabled)
  const geospatialDatasetTimeoutMs = useGympgrphStore(s => s.geospatialDatasetTimeoutMs)
  const geospatialDatasetMaxBytes = useGympgrphStore(s => s.geospatialDatasetMaxBytes)
  const setGeospatialViewMode = useGympgrphStore(s => s.setGeospatialViewMode)
  const setGeospatialAutoFitEnabled = useGympgrphStore(s => s.setGeospatialAutoFitEnabled)
  const setGeospatialDatasetTimeoutMs = useGympgrphStore(s => s.setGeospatialDatasetTimeoutMs)
  const setGeospatialDatasetMaxBytes = useGympgrphStore(s => s.setGeospatialDatasetMaxBytes)

  const [styleUrlDraft, setStyleUrlDraft] = React.useState<string>(() => readLsString(LS_KEYS.geospatialStyleUrl, GRABMAPS_DEFAULT_STYLE_URL))
  const [committedStyleUrl, setCommittedStyleUrl] = React.useState<string>(() => readLsString(LS_KEYS.geospatialStyleUrl, GRABMAPS_DEFAULT_STYLE_URL))
  const [pointStyleDraft, setPointStyleDraft] = React.useState<GeospatialPointStyleConfig>(() => readGeospatialPointStyleConfig())
  const modeCommitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const styleCommitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointStyleCommitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const committedStyleUrlRef = React.useRef(committedStyleUrl)
  React.useEffect(() => {
    committedStyleUrlRef.current = committedStyleUrl
  }, [committedStyleUrl])

  React.useEffect(() => {
    return () => {
      if (modeCommitTimerRef.current) clearTimeout(modeCommitTimerRef.current)
      if (styleCommitTimerRef.current) clearTimeout(styleCommitTimerRef.current)
      if (pointStyleCommitTimerRef.current) clearTimeout(pointStyleCommitTimerRef.current)
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onChanged = () => {
      const next = readLsString(LS_KEYS.geospatialStyleUrl, GRABMAPS_DEFAULT_STYLE_URL)
      setCommittedStyleUrl(next)
      setStyleUrlDraft(prev => (
        prev === MAPLIBRE_CLASSIC_DEFAULT_STYLE_URL ||
        prev === MAPLIBRE_GLOBE_DEFAULT_STYLE_URL ||
        prev === MAPLIBRE_MODERN_DEFAULT_STYLE_URL ||
        prev === committedStyleUrlRef.current
          ? next
          : prev
      ))
    }
    window.addEventListener(GEOSPATIAL_STYLE_URL_CHANGED_EVENT, onChanged)
    return () => {
      window.removeEventListener(GEOSPATIAL_STYLE_URL_CHANGED_EVENT, onChanged)
    }
  }, [])

  const selectGeospatialViewMode = React.useCallback(
    (nextMode: GeospatialViewMode) => {
      const next = normalizeGeospatialViewMode(nextMode)
      if (modeCommitTimerRef.current) clearTimeout(modeCommitTimerRef.current)
      modeCommitTimerRef.current = setTimeout(() => {
        if (typeof window !== 'undefined' && next !== '2d-svg') {
          const nextBuiltInStyle = resolveStandardViewModeStyleUrl(
            next,
            readLsString(LS_KEYS.geospatialStyleUrl, GRABMAPS_DEFAULT_STYLE_URL),
          )
          const currentStyle = readLsString(LS_KEYS.geospatialStyleUrl, GRABMAPS_DEFAULT_STYLE_URL)
          if (currentStyle !== nextBuiltInStyle) {
            writeLsString(LS_KEYS.geospatialStyleUrl, nextBuiltInStyle)
            setCommittedStyleUrl(nextBuiltInStyle)
            setStyleUrlDraft(prev => (
              prev === MAPLIBRE_CLASSIC_DEFAULT_STYLE_URL ||
              prev === MAPLIBRE_GLOBE_DEFAULT_STYLE_URL ||
              prev === MAPLIBRE_MODERN_DEFAULT_STYLE_URL ||
              prev === committedStyleUrlRef.current
                ? nextBuiltInStyle
                : prev
            ))
            window.dispatchEvent(new Event(GEOSPATIAL_STYLE_URL_CHANGED_EVENT))
          }
        }
        setGeospatialViewMode(next)
      }, GEOSPATIAL_COMMIT_DEBOUNCE_MS)
    },
    [setGeospatialViewMode],
  )

  const applyStyleUrl = React.useCallback(() => {
    const next =
      String(styleUrlDraft || '').trim() === ''
        ? getBuiltInDefaultStyleUrl(geospatialViewMode)
        : normalizePersistedGeospatialStyleUrl(styleUrlDraft)
    if (styleCommitTimerRef.current) clearTimeout(styleCommitTimerRef.current)
    styleCommitTimerRef.current = setTimeout(() => {
      writeLsString(LS_KEYS.geospatialStyleUrl, next || GRABMAPS_DEFAULT_STYLE_URL)
      if (next) persistPreferredGrabMapsStyleUrl(next)
      setCommittedStyleUrl(next || GRABMAPS_DEFAULT_STYLE_URL)
      setStyleUrlDraft(next || GRABMAPS_DEFAULT_STYLE_URL)
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new Event(GEOSPATIAL_STYLE_URL_CHANGED_EVENT))
        } catch {
          void 0
        }
      }
    }, GEOSPATIAL_COMMIT_DEBOUNCE_MS)
  }, [geospatialViewMode, styleUrlDraft])

  const resetStyleUrl = React.useCallback(() => {
    const next = getBuiltInDefaultStyleUrl(geospatialViewMode)
    setStyleUrlDraft(next)
    if (styleCommitTimerRef.current) clearTimeout(styleCommitTimerRef.current)
    styleCommitTimerRef.current = setTimeout(() => {
      writeLsString(LS_KEYS.geospatialStyleUrl, next)
      setCommittedStyleUrl(next)
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new Event(GEOSPATIAL_STYLE_URL_CHANGED_EVENT))
        } catch {
          void 0
        }
      }
    }, GEOSPATIAL_COMMIT_DEBOUNCE_MS)
  }, [geospatialViewMode])

  const applyGrabMapsPreset = React.useCallback(() => {
    if (!active) return
    if (modeCommitTimerRef.current) clearTimeout(modeCommitTimerRef.current)
    setGeospatialViewMode('2d-modern')
    if (styleCommitTimerRef.current) clearTimeout(styleCommitTimerRef.current)
    const next = readPreferredGrabMapsStyleUrl()
    setStyleUrlDraft(next)
    styleCommitTimerRef.current = setTimeout(() => {
      writeLsString(LS_KEYS.geospatialStyleUrl, next)
      persistPreferredGrabMapsStyleUrl(next)
      setCommittedStyleUrl(next)
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new Event(GEOSPATIAL_STYLE_URL_CHANGED_EVENT))
        } catch {
          void 0
        }
      }
    }, GEOSPATIAL_COMMIT_DEBOUNCE_MS)
  }, [active, setGeospatialViewMode])

  const applyPointStyle = React.useCallback(() => {
    if (pointStyleCommitTimerRef.current) clearTimeout(pointStyleCommitTimerRef.current)
    pointStyleCommitTimerRef.current = setTimeout(() => {
      writeGeospatialPointStyleConfig(normalizeGeospatialPointStyleConfig(pointStyleDraft))
    }, GEOSPATIAL_COMMIT_DEBOUNCE_MS)
  }, [pointStyleDraft])

  const resetPointStyle = React.useCallback(() => {
    setPointStyleDraft(MAIN_PANEL_DEFAULT_GEOSPATIAL_POINT_STYLE_CONFIG)
    writeGeospatialPointStyleConfig(MAIN_PANEL_DEFAULT_GEOSPATIAL_POINT_STYLE_CONFIG)
  }, [])

  const timeoutDraft = React.useMemo(() => String(Math.floor(geospatialDatasetTimeoutMs)), [geospatialDatasetTimeoutMs])
  const maxBytesMbDraft = React.useMemo(() => String(Math.round(geospatialDatasetMaxBytes / (1024 * 1024))), [geospatialDatasetMaxBytes])

  const [timeoutMsInput, setTimeoutMsInput] = React.useState(timeoutDraft)
  const [maxBytesMbInput, setMaxBytesMbInput] = React.useState(maxBytesMbDraft)
  const [currentLocationState, setCurrentLocationState] = React.useState<'idle' | 'locating' | 'error' | 'done'>('idle')
  const [currentLocationMessage, setCurrentLocationMessage] = React.useState<string>('')

  React.useEffect(() => {
    setTimeoutMsInput(timeoutDraft)
  }, [timeoutDraft])

  React.useEffect(() => {
    setMaxBytesMbInput(maxBytesMbDraft)
  }, [maxBytesMbDraft])

  const commitTimeoutMs = React.useCallback(() => {
    const n = Number(String(timeoutMsInput).trim())
    if (!Number.isFinite(n)) return
    setGeospatialDatasetTimeoutMs(n)
  }, [setGeospatialDatasetTimeoutMs, timeoutMsInput])

  const commitMaxBytes = React.useCallback(() => {
    const mb = Number(String(maxBytesMbInput).trim())
    if (!Number.isFinite(mb)) return
    setGeospatialDatasetMaxBytes(mb * 1024 * 1024)
  }, [maxBytesMbInput, setGeospatialDatasetMaxBytes])

  const useCurrentLocation = React.useCallback(() => {
    if (!active || disabled) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setCurrentLocationState('error')
      setCurrentLocationMessage('Current location is unavailable in this browser.')
      return
    }
    setCurrentLocationState('locating')
    setCurrentLocationMessage('Resolving current location...')
    navigator.geolocation.getCurrentPosition(
      position => {
        const lat = Number(position.coords?.latitude)
        const lng = Number(position.coords?.longitude)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          setCurrentLocationState('error')
          setCurrentLocationMessage('Current location returned invalid coordinates.')
          return
        }
        requestGeospatialCurrentLocation({ lat, lng, zoom: 14 })
        setCurrentLocationState('done')
        setCurrentLocationMessage(`Centered on current location (${lat.toFixed(5)}, ${lng.toFixed(5)}).`)
      },
      error => {
        const message = typeof error?.message === 'string' && error.message.trim()
          ? error.message.trim()
          : 'Unable to read current location.'
        setCurrentLocationState('error')
        setCurrentLocationMessage(message)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }, [active, disabled])

  return (
    <div className="h-full w-full p-3 text-sm text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">Geospatial</div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400">
          style: {
            committedStyleUrl === MAPLIBRE_CLASSIC_DEFAULT_STYLE_URL ||
            committedStyleUrl === MAPLIBRE_MODERN_DEFAULT_STYLE_URL ||
            committedStyleUrl === MAPLIBRE_GLOBE_DEFAULT_STYLE_URL
              ? 'default'
              : 'custom'
          }
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[12px] text-gray-600 dark:text-gray-300">View</label>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-6" aria-label="Geospatial view mode">
          <GeoViewModeChoice
            active={geospatialViewMode === '2d-svg'}
            label="2D (SVG, fallback)"
            detail="No runtime"
            disabled={disabled}
            onClick={() => selectGeospatialViewMode('2d-svg')}
          />
          <GeoViewModeChoice
            active={isGrabMapsPresetActive(committedStyleUrl, geospatialViewMode)}
            label="GrabMaps"
            detail="2D modern preset"
            disabled={disabled}
            onClick={applyGrabMapsPreset}
          />
          <GeoViewModeChoice
            active={geospatialViewMode === '2d'}
            label="2D (MapLibre, Classic)"
            detail="Demo tiles"
            disabled={disabled}
            onClick={() => selectGeospatialViewMode('2d')}
          />
          <GeoViewModeChoice
            active={geospatialViewMode === '2d-modern' && !isGrabMapsPresetActive(committedStyleUrl, geospatialViewMode)}
            label="2D (MapLibre, Modern)"
            detail="Liberty style"
            disabled={disabled}
            onClick={() => selectGeospatialViewMode('2d-modern')}
          />
          <GeoViewModeChoice
            active={geospatialViewMode === '3d'}
            label="3D (MapLibre, Classic)"
            detail="Globe style"
            disabled={disabled}
            onClick={() => selectGeospatialViewMode('3d')}
          />
          <GeoViewModeChoice
            active={geospatialViewMode === '3d-modern'}
            label="3D (MapLibre, Modern)"
            detail="Liberty style"
            disabled={disabled}
            onClick={() => selectGeospatialViewMode('3d-modern')}
          />
        </div>

        <div className="mt-2 rounded border border-gray-200/60 dark:border-gray-800/60 p-2">
          <div className="text-[12px] text-gray-600 dark:text-gray-300">Point Style</div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
            <label className="text-[11px] text-gray-600 dark:text-gray-300">
              Airport
              <input
                className="mt-1 w-full px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
                type="color"
                value={pointStyleDraft.colors.airport}
                disabled={disabled}
                onChange={e => setPointStyleDraft(prev => ({ ...prev, colors: { ...prev.colors, airport: e.target.value } }))}
              />
            </label>
            <label className="text-[11px] text-gray-600 dark:text-gray-300">
              Hotel
              <input
                className="mt-1 w-full px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
                type="color"
                value={pointStyleDraft.colors.hotel}
                disabled={disabled}
                onChange={e => setPointStyleDraft(prev => ({ ...prev, colors: { ...prev.colors, hotel: e.target.value } }))}
              />
            </label>
            <label className="text-[11px] text-gray-600 dark:text-gray-300">
              POI
              <input
                className="mt-1 w-full px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
                type="color"
                value={pointStyleDraft.colors.poi}
                disabled={disabled}
                onChange={e => setPointStyleDraft(prev => ({ ...prev, colors: { ...prev.colors, poi: e.target.value } }))}
              />
            </label>
            <label className="text-[11px] text-gray-600 dark:text-gray-300">
              Radius x
              <input
                className="mt-1 w-full px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
                type="number"
                step="0.05"
                min="0.6"
                max="2.4"
                value={String(pointStyleDraft.radiusMultiplier)}
                disabled={disabled}
                onChange={e => {
                  const n = Number(e.target.value)
                  if (!Number.isFinite(n)) return
                  setPointStyleDraft(prev => ({ ...prev, radiusMultiplier: n }))
                }}
              />
            </label>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
              disabled={disabled}
              onClick={applyPointStyle}
            >
              Apply Point Style
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
              disabled={disabled}
              onClick={resetPointStyle}
            >
              Reset Point Style (MainPanel default)
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <label className="text-[12px] text-gray-600 dark:text-gray-300">Auto-fit</label>
          <button
            type="button"
            className="px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
            disabled={disabled}
            onClick={() => setGeospatialAutoFitEnabled(!geospatialAutoFitEnabled)}
          >
            {geospatialAutoFitEnabled ? 'On' : 'Off'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
            disabled={disabled}
            onClick={() => requestGeospatialFitToData()}
          >
            Fit to data
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
            disabled={disabled}
            onClick={() => requestGeospatialFitToSelection()}
          >
            Fit to selection
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
            disabled={disabled || currentLocationState === 'locating'}
            onClick={useCurrentLocation}
          >
            {currentLocationState === 'locating' ? 'Locating...' : 'Use current location'}
          </button>
        </div>
        {currentLocationMessage ? (
          <div
            className={[
              'text-[11px]',
              currentLocationState === 'error' ? 'text-red-600 dark:text-red-300' : 'text-gray-500 dark:text-gray-400',
            ].join(' ')}
          >
            {currentLocationMessage}
          </div>
        ) : null}

        <div className="mt-2">
          <div className="text-[12px] text-gray-600 dark:text-gray-300">Basemap style URL</div>
          <div className="mt-1 flex items-center gap-2">
            <input
              className="flex-1 min-w-0 px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
              value={styleUrlDraft}
              onChange={e => setStyleUrlDraft(e.target.value)}
              placeholder="Leave blank for MapLibre default style"
              spellCheck={false}
              disabled={disabled}
            />
            <button
              type="button"
              className="px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
              disabled={disabled}
              onClick={applyStyleUrl}
            >
              Apply
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
              disabled={disabled}
              onClick={resetStyleUrl}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-2">
          <div className="text-[12px] text-gray-600 dark:text-gray-300">Dataset loading</div>
          <div className="mt-1 grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[12px] text-gray-600 dark:text-gray-300">Timeout (ms)</label>
              <div className="flex items-center gap-2">
                <input
                  className="w-28 px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
                  value={timeoutMsInput}
                  onChange={e => setTimeoutMsInput(e.target.value)}
                  onBlur={commitTimeoutMs}
                  disabled={disabled}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-[12px] text-gray-600 dark:text-gray-300">Max bytes (MB)</label>
              <div className="flex items-center gap-2">
                <input
                  className="w-28 px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
                  value={maxBytesMbInput}
                  onChange={e => setMaxBytesMbInput(e.target.value)}
                  onBlur={commitMaxBytes}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
