import React from 'react'
import { emitGeospatialModeChanged, type GeospatialViewMode } from 'grph-shared/geospatial/events'
import { GEOSPATIAL_STYLE_URL_CHANGED_EVENT } from 'grph-shared/geospatial/constants'
import { UI_THEME_TOKENS } from 'grph-shared/ui/themeTokens'
import { requestGeospatialFitToData, requestGeospatialFitToSelection } from './geospatialFit'
import { LS_KEYS } from './lib/config'
import { useGympgrphStore } from './store'
import {
  MAPLIBRE_CLASSIC_DEFAULT_STYLE_URL,
  MAPLIBRE_GLOBE_DEFAULT_STYLE_URL,
  MAPLIBRE_MODERN_DEFAULT_STYLE_URL,
  normalizePersistedGeospatialStyleUrl,
  SAFE_SVG_FALLBACK_STYLE_SENTINEL,
} from './features/geospatial/basemapStyle'

type GeospatialPanelHostProps = {
  active?: boolean
  showDatasetsManager?: boolean
  panelTypography?: unknown
  snapshot?: unknown
  handlers?: unknown
}

const MAPLIBRE_DEFAULT_STYLE_URL = MAPLIBRE_CLASSIC_DEFAULT_STYLE_URL
const getBuiltInDefaultStyleUrl = (mode: GeospatialViewMode): string =>
  mode === '3d'
    ? MAPLIBRE_GLOBE_DEFAULT_STYLE_URL
    : mode === '3d-modern'
      ? MAPLIBRE_MODERN_DEFAULT_STYLE_URL
      : MAPLIBRE_CLASSIC_DEFAULT_STYLE_URL

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
  const geospatialViewMode = useGympgrphStore(s => s.geospatialViewMode)
  const geospatialAutoFitEnabled = useGympgrphStore(s => s.geospatialAutoFitEnabled)
  const geospatialDatasetTimeoutMs = useGympgrphStore(s => s.geospatialDatasetTimeoutMs)
  const geospatialDatasetMaxBytes = useGympgrphStore(s => s.geospatialDatasetMaxBytes)
  const setGeospatialViewMode = useGympgrphStore(s => s.setGeospatialViewMode)
  const setGeospatialAutoFitEnabled = useGympgrphStore(s => s.setGeospatialAutoFitEnabled)
  const setGeospatialDatasetTimeoutMs = useGympgrphStore(s => s.setGeospatialDatasetTimeoutMs)
  const setGeospatialDatasetMaxBytes = useGympgrphStore(s => s.setGeospatialDatasetMaxBytes)

  const [styleUrlDraft, setStyleUrlDraft] = React.useState<string>(() => readLsString(LS_KEYS.geospatialStyleUrl, MAPLIBRE_DEFAULT_STYLE_URL))
  const [committedStyleUrl, setCommittedStyleUrl] = React.useState<string>(() => readLsString(LS_KEYS.geospatialStyleUrl, MAPLIBRE_DEFAULT_STYLE_URL))

  const committedStyleUrlRef = React.useRef(committedStyleUrl)
  React.useEffect(() => {
    committedStyleUrlRef.current = committedStyleUrl
  }, [committedStyleUrl])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onChanged = () => {
      const next = readLsString(LS_KEYS.geospatialStyleUrl, MAPLIBRE_DEFAULT_STYLE_URL)
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
      const next = nextMode === '3d-modern' ? '3d-modern' : nextMode === '3d' ? '3d' : nextMode === '2d-svg' ? '2d-svg' : '2d'
      if (typeof window !== 'undefined') {
        try {
          const persisted = String(window.localStorage.getItem(LS_KEYS.geospatialViewMode) || '').trim()
          if (persisted !== next) {
            window.localStorage.setItem(LS_KEYS.geospatialViewMode, next)
          }
          if (next === '2d' || next === '3d' || next === '3d-modern') {
            const persistedStyle = String(window.localStorage.getItem(LS_KEYS.geospatialStyleUrl) || '').trim()
            const shouldPromoteBuiltInDefault =
              !persistedStyle ||
              persistedStyle === SAFE_SVG_FALLBACK_STYLE_SENTINEL ||
              persistedStyle === MAPLIBRE_CLASSIC_DEFAULT_STYLE_URL ||
              persistedStyle === MAPLIBRE_GLOBE_DEFAULT_STYLE_URL ||
              persistedStyle === MAPLIBRE_MODERN_DEFAULT_STYLE_URL ||
              persistedStyle.toLowerCase().startsWith('kg:style:')
            if (shouldPromoteBuiltInDefault) {
              const nextBuiltInStyle = getBuiltInDefaultStyleUrl(next)
              window.localStorage.setItem(LS_KEYS.geospatialStyleUrl, nextBuiltInStyle)
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
        } catch {
          void 0
        }
      }
      emitGeospatialModeChanged({ enabled: true, viewMode: next })
      setGeospatialViewMode(next)
    },
    [setGeospatialViewMode],
  )

  const applyStyleUrl = React.useCallback(() => {
    const next =
      String(styleUrlDraft || '').trim() === ''
        ? getBuiltInDefaultStyleUrl(geospatialViewMode)
        : normalizePersistedGeospatialStyleUrl(styleUrlDraft)
    writeLsString(LS_KEYS.geospatialStyleUrl, next || MAPLIBRE_DEFAULT_STYLE_URL)
    setCommittedStyleUrl(next || MAPLIBRE_DEFAULT_STYLE_URL)
    setStyleUrlDraft(next || MAPLIBRE_DEFAULT_STYLE_URL)
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new Event(GEOSPATIAL_STYLE_URL_CHANGED_EVENT))
      } catch {
        void 0
      }
    }
  }, [geospatialViewMode, styleUrlDraft])

  const resetStyleUrl = React.useCallback(() => {
    const next = getBuiltInDefaultStyleUrl(geospatialViewMode)
    setStyleUrlDraft(next)
    writeLsString(LS_KEYS.geospatialStyleUrl, next)
    setCommittedStyleUrl(next)
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new Event(GEOSPATIAL_STYLE_URL_CHANGED_EVENT))
      } catch {
        void 0
      }
    }
  }, [geospatialViewMode])

  const timeoutDraft = React.useMemo(() => String(Math.floor(geospatialDatasetTimeoutMs)), [geospatialDatasetTimeoutMs])
  const maxBytesMbDraft = React.useMemo(() => String(Math.round(geospatialDatasetMaxBytes / (1024 * 1024))), [geospatialDatasetMaxBytes])

  const [timeoutMsInput, setTimeoutMsInput] = React.useState(timeoutDraft)
  const [maxBytesMbInput, setMaxBytesMbInput] = React.useState(maxBytesMbDraft)

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

  const disabled = !active

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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4" aria-label="Geospatial view mode">
          <GeoViewModeChoice
            active={geospatialViewMode === '2d-svg'}
            label="2D (SVG, fallback)"
            detail="No runtime"
            disabled={disabled}
            onClick={() => selectGeospatialViewMode('2d-svg')}
          />
          <GeoViewModeChoice
            active={geospatialViewMode === '2d'}
            label="2D (MapLibre, Classic)"
            detail="Demo tiles"
            disabled={disabled}
            onClick={() => selectGeospatialViewMode('2d')}
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
        </div>

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
