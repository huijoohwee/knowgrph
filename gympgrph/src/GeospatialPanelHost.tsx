import React from 'react'
import type { GeospatialViewMode } from 'grph-shared/geospatial/events'
import { GEOSPATIAL_STYLE_URL_CHANGED_EVENT } from 'grph-shared/geospatial/constants'
import { UI_THEME_TOKENS } from 'grph-shared/ui/themeTokens'
import { coercePanelTypography, type PanelTypography } from 'grph-shared/ui/panelTypography'
import {
  KTV_KEY_TYPE_VALUE_GRID_CLASS_NAME,
  KTV_ROW_LABEL_CELL_CLASS_NAME,
  KTV_ROW_VALUE_CELL_CLASS_NAME,
} from 'grph-shared/ui/keyTypeValueRows'
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
  renderTypeIcon?: (args: { typeLabel: string }) => React.ReactNode
  snapshot?: unknown
  handlers?: unknown
}

type GeoPanelTypeIconRenderer = NonNullable<GeospatialPanelHostProps['renderTypeIcon']>

const MAPLIBRE_DEFAULT_STYLE_URL = MAPLIBRE_CLASSIC_DEFAULT_STYLE_URL
const GEOSPATIAL_COMMIT_DEBOUNCE_MS = 120

const readPreferredGrabMapsStyleUrl = (): string => {
  return readLsString(LS_KEYS.grabMapsBasemapStyleUrl, GRABMAPS_DEFAULT_STYLE_URL)
}

const persistPreferredGrabMapsStyleUrl = (styleUrl: string): void => {
  if (!isGrabMapsStyleUrl(styleUrl)) return
  writeLsString(LS_KEYS.grabMapsBasemapStyleUrl, styleUrl)
}

type GeoPanelKtvRowProps = {
  keyNode: React.ReactNode
  typeNode: React.ReactNode
  valueNode: React.ReactNode
  panelTypography: PanelTypography
  isActive?: boolean
  header?: boolean
  align?: 'center' | 'start'
}

type GeoPanelSectionProps = {
  title: string
  panelTypography: PanelTypography
  children: React.ReactNode
}

type GeoPanelValueCellProps = {
  children: React.ReactNode
  className?: string
}

const geospatialPanelRootClassName = `h-full w-full ${UI_THEME_TOKENS.text.primary}`
const geospatialPanelValueCellClassName = 'flex w-full min-w-0 max-w-full flex-wrap items-center gap-1 overflow-hidden justify-start sm:justify-end'
const GeoPanelTypeIconRenderContext = React.createContext<GeoPanelTypeIconRenderer | null>(null)

function GeoPanelValueCell({ children, className }: GeoPanelValueCellProps): React.ReactElement {
  return (
    <span className={[geospatialPanelValueCellClassName, className || ''].filter(Boolean).join(' ')}>
      {children}
    </span>
  )
}

function GeoPanelKtvRow(props: GeoPanelKtvRowProps): React.ReactElement {
  const { keyNode, typeNode, valueNode, panelTypography, isActive = false, header = false, align = 'center' } = props
  const renderTypeIcon = React.useContext(GeoPanelTypeIconRenderContext)
  const alignClass = align === 'start' ? 'items-start' : 'items-center'
  const activeClass = header ? '' : isActive ? UI_THEME_TOKENS.table.rowSelected : UI_THEME_TOKENS.table.rowHoverHighlight
  const textFlowClass = 'whitespace-nowrap'
  const renderedTypeNode = React.useMemo(() => {
    if (header || !renderTypeIcon || typeof typeNode !== 'string') return typeNode
    const typeLabel = typeNode.trim()
    if (!typeLabel) return typeNode
    return renderTypeIcon({ typeLabel }) ?? typeNode
  }, [header, renderTypeIcon, typeNode])
  const rootClassName = [
    `grid w-full ${KTV_KEY_TYPE_VALUE_GRID_CLASS_NAME} gap-x-2 gap-y-0 rounded`,
    panelTypography.panelTextClass,
    header ? 'h-9 py-0' : 'py-0.5',
    alignClass,
    activeClass,
  ]
    .filter(Boolean)
    .join(' ')
  const labelClassName = [
    KTV_ROW_LABEL_CELL_CLASS_NAME,
    'items-center gap-1',
    textFlowClass,
    header ? `font-semibold ${UI_THEME_TOKENS.text.secondary}` : UI_THEME_TOKENS.text.primary,
  ].join(' ')
  const typeClassName = [
    KTV_ROW_LABEL_CELL_CLASS_NAME,
    'items-center justify-start sm:justify-end',
    textFlowClass,
    header ? `font-semibold ${UI_THEME_TOKENS.text.secondary}` : UI_THEME_TOKENS.text.secondary,
  ].join(' ')
  const valueClassName = [
    KTV_ROW_VALUE_CELL_CLASS_NAME,
    'items-center',
    header ? `font-semibold ${UI_THEME_TOKENS.text.secondary}` : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <dl className={rootClassName}>
      <dt className={labelClassName}>{keyNode}</dt>
      <dd className={typeClassName}>{renderedTypeNode}</dd>
      <dd className={valueClassName}>{valueNode}</dd>
    </dl>
  )
}

function GeoPanelSection(props: GeoPanelSectionProps): React.ReactElement {
  const { title, panelTypography, children } = props
  return (
    <section className="space-y-0.5" aria-label={`Geo ${title}`}>
      <h3 className={['px-1 pt-2 pb-1 font-semibold', panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary].join(' ')}>
        {title}
      </h3>
      <section className="space-y-0.5" aria-label={`${title} settings`}>{children}</section>
    </section>
  )
}

const buildGeoPanelButtonClassName = (selected = false, disabled = false): string => [
  'inline-flex min-h-[var(--kg-control-height,28px)] min-w-0 items-center justify-center rounded border px-2 py-0.5 text-xs transition-colors',
  selected
    ? `${UI_THEME_TOKENS.button.activeBorder} ${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
    : `${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.button.hoverBg}`,
  disabled ? 'cursor-not-allowed opacity-50' : '',
].filter(Boolean).join(' ')

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
  const panelTypography = React.useMemo(
    () => coercePanelTypography(props.panelTypography as Partial<PanelTypography> | null | undefined),
    [props.panelTypography],
  )
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

  const styleStatusLabel =
    committedStyleUrl === MAPLIBRE_CLASSIC_DEFAULT_STYLE_URL ||
    committedStyleUrl === MAPLIBRE_MODERN_DEFAULT_STYLE_URL ||
    committedStyleUrl === MAPLIBRE_GLOBE_DEFAULT_STYLE_URL
      ? 'default'
      : 'custom'
  const geospatialPanelInputClassName = `${panelTypography.keyValueInputClass} min-w-0`
  const geospatialPanelTextInputClassName = `${geospatialPanelInputClassName} text-left`
  const geospatialPanelCompactInputClassName = `${geospatialPanelInputClassName} max-w-[7rem]`
  const geospatialPanelColorInputClassName = `h-[var(--kg-control-height,28px)] w-16 rounded border p-0.5 ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg}`
  const geospatialPanelNoteClassName = `${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.tertiary}`
  const geospatialPanelMessageClassName = currentLocationState === 'error'
    ? `${panelTypography.microLabelClass} text-red-600 dark:text-red-300`
    : geospatialPanelNoteClassName

  return (
    <GeoPanelTypeIconRenderContext.Provider value={props.renderTypeIcon || null}>
      <article className={`${geospatialPanelRootClassName} flex min-h-full flex-col space-y-0`}>
        <header className={`sticky top-0 z-20 border-b ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.panel.border}`}>
          <GeoPanelKtvRow
            keyNode="Key"
            typeNode="Type"
            valueNode="Value"
            panelTypography={panelTypography}
            header
          />
        </header>

      <section className="space-y-2 px-1 py-2">
        <GeoPanelSection title="View" panelTypography={panelTypography}>
          <GeoPanelKtvRow
            keyNode="SVG fallback"
            typeNode="Static"
            panelTypography={panelTypography}
            isActive={geospatialViewMode === '2d-svg'}
            valueNode={(
              <GeoPanelValueCell>
                <button
                  type="button"
                  className={buildGeoPanelButtonClassName(geospatialViewMode === '2d-svg', disabled)}
                  disabled={disabled}
                  aria-pressed={geospatialViewMode === '2d-svg'}
                  aria-label="2D (SVG, fallback) No runtime"
                  onClick={() => selectGeospatialViewMode('2d-svg')}
                >
                  {geospatialViewMode === '2d-svg' ? 'Active' : 'Select'}
                </button>
              </GeoPanelValueCell>
            )}
          />
          <GeoPanelKtvRow
            keyNode="GrabMaps"
            typeNode="Preset"
            panelTypography={panelTypography}
            isActive={isGrabMapsPresetActive(committedStyleUrl, geospatialViewMode)}
            valueNode={(
              <GeoPanelValueCell>
                <button
                  type="button"
                  className={buildGeoPanelButtonClassName(isGrabMapsPresetActive(committedStyleUrl, geospatialViewMode), disabled)}
                  disabled={disabled}
                  aria-pressed={isGrabMapsPresetActive(committedStyleUrl, geospatialViewMode)}
                  aria-label="GrabMaps 2D modern preset"
                  onClick={applyGrabMapsPreset}
                >
                  {isGrabMapsPresetActive(committedStyleUrl, geospatialViewMode) ? 'Active' : 'Select'}
                </button>
              </GeoPanelValueCell>
            )}
          />
          <GeoPanelKtvRow
            keyNode="2D Classic"
            typeNode="Tiles"
            panelTypography={panelTypography}
            isActive={geospatialViewMode === '2d'}
            valueNode={(
              <GeoPanelValueCell>
                <button
                  type="button"
                  className={buildGeoPanelButtonClassName(geospatialViewMode === '2d', disabled)}
                  disabled={disabled}
                  aria-pressed={geospatialViewMode === '2d'}
                  aria-label="2D (MapLibre, Classic) Demo tiles"
                  onClick={() => selectGeospatialViewMode('2d')}
                >
                  {geospatialViewMode === '2d' ? 'Active' : 'Select'}
                </button>
              </GeoPanelValueCell>
            )}
          />
          <GeoPanelKtvRow
            keyNode="2D Modern"
            typeNode="Style"
            panelTypography={panelTypography}
            isActive={geospatialViewMode === '2d-modern' && !isGrabMapsPresetActive(committedStyleUrl, geospatialViewMode)}
            valueNode={(
              <GeoPanelValueCell>
                <button
                  type="button"
                  className={buildGeoPanelButtonClassName(
                    geospatialViewMode === '2d-modern' && !isGrabMapsPresetActive(committedStyleUrl, geospatialViewMode),
                    disabled,
                  )}
                  disabled={disabled}
                  aria-pressed={geospatialViewMode === '2d-modern' && !isGrabMapsPresetActive(committedStyleUrl, geospatialViewMode)}
                  aria-label="2D (MapLibre, Modern) Liberty style"
                  onClick={() => selectGeospatialViewMode('2d-modern')}
                >
                  {geospatialViewMode === '2d-modern' && !isGrabMapsPresetActive(committedStyleUrl, geospatialViewMode) ? 'Active' : 'Select'}
                </button>
              </GeoPanelValueCell>
            )}
          />
          <GeoPanelKtvRow
            keyNode="3D Classic"
            typeNode="Globe"
            panelTypography={panelTypography}
            isActive={geospatialViewMode === '3d'}
            valueNode={(
              <GeoPanelValueCell>
                <button
                  type="button"
                  className={buildGeoPanelButtonClassName(geospatialViewMode === '3d', disabled)}
                  disabled={disabled}
                  aria-pressed={geospatialViewMode === '3d'}
                  aria-label="3D (MapLibre, Classic) Globe style"
                  onClick={() => selectGeospatialViewMode('3d')}
                >
                  {geospatialViewMode === '3d' ? 'Active' : 'Select'}
                </button>
              </GeoPanelValueCell>
            )}
          />
          <GeoPanelKtvRow
            keyNode="3D Modern"
            typeNode="Style"
            panelTypography={panelTypography}
            isActive={geospatialViewMode === '3d-modern'}
            valueNode={(
              <GeoPanelValueCell>
                <button
                  type="button"
                  className={buildGeoPanelButtonClassName(geospatialViewMode === '3d-modern', disabled)}
                  disabled={disabled}
                  aria-pressed={geospatialViewMode === '3d-modern'}
                  aria-label="3D (MapLibre, Modern) Liberty style"
                  onClick={() => selectGeospatialViewMode('3d-modern')}
                >
                  {geospatialViewMode === '3d-modern' ? 'Active' : 'Select'}
                </button>
              </GeoPanelValueCell>
            )}
          />
        </GeoPanelSection>

        <GeoPanelSection title="Point Style" panelTypography={panelTypography}>
          <GeoPanelKtvRow
            keyNode="Airport"
            typeNode="Color"
            panelTypography={panelTypography}
            valueNode={(
              <GeoPanelValueCell>
                <input
                  className={geospatialPanelColorInputClassName}
                  type="color"
                  aria-label="Airport"
                  value={pointStyleDraft.colors.airport}
                  disabled={disabled}
                  onChange={e => setPointStyleDraft(prev => ({ ...prev, colors: { ...prev.colors, airport: e.target.value } }))}
                />
              </GeoPanelValueCell>
            )}
          />
          <GeoPanelKtvRow
            keyNode="Hotel"
            typeNode="Color"
            panelTypography={panelTypography}
            valueNode={(
              <GeoPanelValueCell>
                <input
                  className={geospatialPanelColorInputClassName}
                  type="color"
                  aria-label="Hotel"
                  value={pointStyleDraft.colors.hotel}
                  disabled={disabled}
                  onChange={e => setPointStyleDraft(prev => ({ ...prev, colors: { ...prev.colors, hotel: e.target.value } }))}
                />
              </GeoPanelValueCell>
            )}
          />
          <GeoPanelKtvRow
            keyNode="POI"
            typeNode="Color"
            panelTypography={panelTypography}
            valueNode={(
              <GeoPanelValueCell>
                <input
                  className={geospatialPanelColorInputClassName}
                  type="color"
                  aria-label="POI"
                  value={pointStyleDraft.colors.poi}
                  disabled={disabled}
                  onChange={e => setPointStyleDraft(prev => ({ ...prev, colors: { ...prev.colors, poi: e.target.value } }))}
                />
              </GeoPanelValueCell>
            )}
          />
          <GeoPanelKtvRow
            keyNode="Radius x"
            typeNode="Scale"
            panelTypography={panelTypography}
            valueNode={(
              <GeoPanelValueCell>
                <input
                  className={geospatialPanelCompactInputClassName}
                  type="number"
                  step="0.05"
                  min="0.6"
                  max="2.4"
                  aria-label="Radius x"
                  value={String(pointStyleDraft.radiusMultiplier)}
                  disabled={disabled}
                  onChange={e => {
                    const n = Number(e.target.value)
                    if (!Number.isFinite(n)) return
                    setPointStyleDraft(prev => ({ ...prev, radiusMultiplier: n }))
                  }}
                />
              </GeoPanelValueCell>
            )}
          />
          <GeoPanelKtvRow
            keyNode="Point Style"
            typeNode="Action"
            panelTypography={panelTypography}
            valueNode={(
              <GeoPanelValueCell>
                <button type="button" className={buildGeoPanelButtonClassName(false, disabled)} disabled={disabled} onClick={applyPointStyle}>
                  Apply Point Style
                </button>
                <button type="button" className={buildGeoPanelButtonClassName(false, disabled)} disabled={disabled} onClick={resetPointStyle}>
                  Reset Point Style
                </button>
              </GeoPanelValueCell>
            )}
          />
        </GeoPanelSection>

        <GeoPanelSection title="Camera" panelTypography={panelTypography}>
          <GeoPanelKtvRow
            keyNode="Auto-fit"
            typeNode="Toggle"
            panelTypography={panelTypography}
            isActive={geospatialAutoFitEnabled}
            valueNode={(
              <GeoPanelValueCell>
                <button
                  type="button"
                  className={buildGeoPanelButtonClassName(geospatialAutoFitEnabled, disabled)}
                  disabled={disabled}
                  aria-pressed={geospatialAutoFitEnabled}
                  onClick={() => setGeospatialAutoFitEnabled(!geospatialAutoFitEnabled)}
                >
                  {geospatialAutoFitEnabled ? 'On' : 'Off'}
                </button>
              </GeoPanelValueCell>
            )}
          />
          <GeoPanelKtvRow
            keyNode="Fit"
            typeNode="Action"
            panelTypography={panelTypography}
            valueNode={(
              <GeoPanelValueCell>
                <button type="button" className={buildGeoPanelButtonClassName(false, disabled)} disabled={disabled} onClick={() => requestGeospatialFitToData()}>
                  Fit to data
                </button>
                <button type="button" className={buildGeoPanelButtonClassName(false, disabled)} disabled={disabled} onClick={() => requestGeospatialFitToSelection()}>
                  Fit to selection
                </button>
              </GeoPanelValueCell>
            )}
          />
          <GeoPanelKtvRow
            keyNode="Current Location"
            typeNode="Browser"
            panelTypography={panelTypography}
            align={currentLocationMessage ? 'start' : 'center'}
            valueNode={(
              <GeoPanelValueCell className="items-start">
                <button
                  type="button"
                  className={buildGeoPanelButtonClassName(false, disabled || currentLocationState === 'locating')}
                  disabled={disabled || currentLocationState === 'locating'}
                  onClick={useCurrentLocation}
                >
                  {currentLocationState === 'locating' ? 'Locating...' : 'Use current location'}
                </button>
                {currentLocationMessage ? (
                  <span className={geospatialPanelMessageClassName}>{currentLocationMessage}</span>
                ) : null}
              </GeoPanelValueCell>
            )}
          />
        </GeoPanelSection>

        <GeoPanelSection title="Basemap" panelTypography={panelTypography}>
          <GeoPanelKtvRow
            keyNode="Style URL"
            typeNode={styleStatusLabel}
            panelTypography={panelTypography}
            align="start"
            valueNode={(
              <GeoPanelValueCell className="items-start">
                <input
                  className={`${geospatialPanelTextInputClassName} min-w-[14rem] flex-1`}
                  value={styleUrlDraft}
                  onChange={e => setStyleUrlDraft(e.target.value)}
                  placeholder="Leave blank for MapLibre default style"
                  spellCheck={false}
                  disabled={disabled}
                />
                <button type="button" className={buildGeoPanelButtonClassName(false, disabled)} disabled={disabled} onClick={applyStyleUrl}>
                  Apply
                </button>
                <button type="button" className={buildGeoPanelButtonClassName(false, disabled)} disabled={disabled} onClick={resetStyleUrl}>
                  Reset
                </button>
              </GeoPanelValueCell>
            )}
          />
        </GeoPanelSection>

        <GeoPanelSection title="Dataset" panelTypography={panelTypography}>
          <GeoPanelKtvRow
            keyNode="Timeout"
            typeNode="ms"
            panelTypography={panelTypography}
            valueNode={(
              <GeoPanelValueCell>
                <input
                  className={geospatialPanelCompactInputClassName}
                  aria-label="Timeout (ms)"
                  value={timeoutMsInput}
                  onChange={e => setTimeoutMsInput(e.target.value)}
                  onBlur={commitTimeoutMs}
                  disabled={disabled}
                />
              </GeoPanelValueCell>
            )}
          />
          <GeoPanelKtvRow
            keyNode="Max bytes"
            typeNode="MB"
            panelTypography={panelTypography}
            valueNode={(
              <GeoPanelValueCell>
                <input
                  className={geospatialPanelCompactInputClassName}
                  aria-label="Max bytes (MB)"
                  value={maxBytesMbInput}
                  onChange={e => setMaxBytesMbInput(e.target.value)}
                  onBlur={commitMaxBytes}
                  disabled={disabled}
                />
              </GeoPanelValueCell>
            )}
          />
        </GeoPanelSection>
      </section>
      </article>
    </GeoPanelTypeIconRenderContext.Provider>
  )
}
